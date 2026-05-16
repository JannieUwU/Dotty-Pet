using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using UnityEngine;

/// <summary>
/// Moves the Unity window left/right so the pet walks across the screen.
/// Windows-only. Drop anywhere in the scene.
/// </summary>
public class PetLocomotion : MonoBehaviour
{
    [Header("Enable")]
    public bool enableLocomotion = true;

    [Header("Timing")]
    [Range(0f, 60f)]    public float randomizer   = 10f;
    [Range(10f, 4000f)] public float minWalkPixels = 250f;
    [Range(10f, 4000f)] public float maxWalkPixels = 550f;

    [Header("Speed")]
    [Range(0f, 10f)] public float windowSpeed = 2f;

    [Header("Animator params")]
    public string walkLeftParam  = "WalkLeft";
    public string walkRightParam = "WalkRight";

    [Header("Avatar bounds (optional)")]
    public Transform avatarBoundsRoot;
    public Camera    boundsCamera;
    [Min(0f)] public float edgeThreshold = 12f;

    // ── Win32 ─────────────────────────────────────────────────────────────────
    [StructLayout(LayoutKind.Sequential)] struct RECT  { public int Left,Top,Right,Bottom; }
    [StructLayout(LayoutKind.Sequential)] struct POINT { public int X,Y; }
    [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Auto)] struct MONITORINFO
    { public int cbSize; public RECT rcMonitor,rcWork; public uint dwFlags; }

    delegate bool EnumWindowsProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc f, IntPtr l);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint c);
    [DllImport("user32.dll")] static extern int  GetWindowTextLength(IntPtr h);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] static extern void GetWindowThreadProcessId(IntPtr h, out uint p);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h,IntPtr i,int x,int y,int cx,int cy,uint f);
    [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr h, ref POINT p);
    [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr h, uint f);
    [DllImport("user32.dll",CharSet=CharSet.Auto)] static extern bool GetMonitorInfo(IntPtr m, ref MONITORINFO i);
    [DllImport("user32.dll")] static extern int GetSystemMetrics(int n);
    const uint SWP_NOSIZE=0x0001,SWP_NOZORDER=0x0004,SWP_NOACTIVATE=0x0010,GW_OWNER=4,MON_NEAREST=2;
    const int SM_VX=76,SM_VW=78;

    // ── State ─────────────────────────────────────────────────────────────────
    Animator   _anim;
    IntPtr     _hwnd;
    bool       _walking;
    int        _dir, _forcedDir;
    float      _remaining, _nextDecision, _pauseUntil;
    Renderer[] _renderers;
    float      _nextRendererScan, _nextAnimScan;
    bool       _wasIdle;
    static readonly Vector3[] _corners = new Vector3[8];

    void OnEnable()
    {
        Application.runInBackground = true;
        CacheWindow();
        ScanRenderers(true);
        ResolveAnimator(true);
        ScheduleNext(true);
        _wasIdle = true;
    }

    void Update()
    {
#if !(UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN)
        return;
#else
        if (!enableLocomotion) { Stop(); return; }

        ResolveAnimator(false);
        ScanRenderers(false);
        if (_anim == null) return;
        if (_hwnd == IntPtr.Zero) CacheWindow();
        if (_hwnd == IntPtr.Zero) return;

        float t = Time.unscaledTime;
        bool idle = _anim.GetCurrentAnimatorStateInfo(0).IsName("Idle");

        if (!idle)
        {
            if (_walking) Stop();
            _wasIdle = false;
            return;
        }
        if (!_wasIdle) { _pauseUntil = t + UnityEngine.Random.Range(0.1f, 0.3f); _wasIdle = true; }
        if (t < _pauseUntil) return;

        if (!_walking)
        {
            if (randomizer > 0f && t >= _nextDecision) StartWalk();
            return;
        }
        StepWalk();
#endif
    }

    // ── Walk logic ────────────────────────────────────────────────────────────

    void StartWalk()
    {
        _dir = _forcedDir != 0 ? _forcedDir : PickDir();
        if (_dir == 0) _dir = UnityEngine.Random.value < 0.5f ? -1 : 1;
        _forcedDir  = 0;
        _remaining  = UnityEngine.Random.Range(minWalkPixels, maxWalkPixels);
        _walking    = true;
        _anim.SetBool(walkLeftParam,  _dir < 0);
        _anim.SetBool(walkRightParam, _dir > 0);
    }

    void StepWalk()
    {
        if (!GetWindowRect(_hwnd, out RECT r)) { Stop(); ScheduleNext(false); return; }
        int w = r.Right - r.Left;
        GetMonitorBounds(out int mL, out int mR);

        int minX, maxX;
        if (TryAvatarBounds(out float aMinU, out float aMaxU))
        {
            float scale = GetClientScale(w);
            int border  = GetBorderLeft();
            minX = mL - border - Mathf.RoundToInt(aMinU * scale);
            maxX = mR - border - Mathf.RoundToInt(aMaxU * scale);
        }
        else { minX = mL; maxX = mR - w; }
        if (maxX < minX) maxX = minX;

        float step  = Mathf.Max(0f, windowSpeed) * 100f * Time.unscaledDeltaTime;
        float move  = Mathf.Min(step, _remaining);
        int target  = r.Left + Mathf.RoundToInt(move * _dir);
        int clamped = Mathf.Clamp(target, minX, maxX);
        int moved   = Mathf.Abs(clamped - r.Left);
        _remaining -= moved;

        SetWindowPos(_hwnd, IntPtr.Zero, clamped, r.Top, 0, 0, SWP_NOSIZE|SWP_NOZORDER|SWP_NOACTIVATE);

        if (moved <= 0) { _remaining = 0; _forcedDir = -_dir; }
        if (_remaining <= 0.01f) { Stop(); _pauseUntil = Time.unscaledTime + UnityEngine.Random.Range(0.4f,1.2f); ScheduleNext(false); }
    }

    void Stop()
    {
        if (_anim != null) { _anim.SetBool(walkLeftParam, false); _anim.SetBool(walkRightParam, false); }
        _walking = false; _remaining = 0; _dir = 0;
    }

    void ScheduleNext(bool immediate)
    {
        float t = Time.unscaledTime;
        float d = immediate ? UnityEngine.Random.Range(0.2f, 0.8f) : Mathf.Max(0.1f, randomizer);
        _nextDecision = t + UnityEngine.Random.Range(d, d * 2f);
    }

    int PickDir()
    {
        if (!TryAvatarBounds(out float minU, out float maxU)) return 0;
        GetMonitorBounds(out int mL, out int mR);
        if (!GetWindowRect(_hwnd, out RECT r)) return 0;
        float scale = GetClientScale(r.Right - r.Left);
        int border  = GetBorderLeft();
        int gMin = GetBorderLeft() + Mathf.RoundToInt(minU * scale);  // approx global
        int gMax = GetBorderLeft() + Mathf.RoundToInt(maxU * scale);
        float thr = edgeThreshold * scale;
        float lDist = gMin - mL, rDist = mR - gMax;
        if (rDist <= thr) return -1;
        if (lDist <= thr) return  1;
        return 0;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    void ResolveAnimator(bool force)
    {
        float t = Time.unscaledTime;
        if (!force && t < _nextAnimScan) return;
        _nextAnimScan = t + 0.75f;
        if (_anim != null && _anim.isActiveAndEnabled) return;
        _anim = GetComponent<Animator>() ?? FindFirstObjectByType<PetAnimatorController>()?.GetComponent<Animator>();
    }

    void ScanRenderers(bool force)
    {
        float t = Time.unscaledTime;
        if (!force && t < _nextRendererScan) return;
        _nextRendererScan = t + 1f;
        Transform root = avatarBoundsRoot != null ? avatarBoundsRoot : transform;
        _renderers = root.GetComponentsInChildren<Renderer>(true);
    }

    void CacheWindow()
    {
        uint pid = (uint)Process.GetCurrentProcess().Id;
        IntPtr best = IntPtr.Zero; long bestArea = -1;
        EnumWindows((h, _) =>
        {
            if (!IsWindowVisible(h) || GetWindow(h, GW_OWNER) != IntPtr.Zero) return true;
            GetWindowThreadProcessId(h, out uint wp);
            if (wp != pid || GetWindowTextLength(h) <= 0) return true;
            if (!GetWindowRect(h, out RECT rr)) return true;
            long area = (long)(rr.Right-rr.Left)*(rr.Bottom-rr.Top);
            if (area > bestArea) { bestArea = area; best = h; }
            return true;
        }, IntPtr.Zero);
        _hwnd = best;
    }

    void GetMonitorBounds(out int left, out int right)
    {
        left = GetSystemMetrics(SM_VX);
        right = left + GetSystemMetrics(SM_VW);
        if (_hwnd == IntPtr.Zero) return;
        IntPtr mon = MonitorFromWindow(_hwnd, MON_NEAREST);
        if (mon == IntPtr.Zero) return;
        MONITORINFO mi = new MONITORINFO { cbSize = Marshal.SizeOf<MONITORINFO>() };
        if (GetMonitorInfo(mon, ref mi)) { left = mi.rcMonitor.Left; right = mi.rcMonitor.Right; }
    }

    float GetClientScale(int winW)
    {
        if (!GetClientRect(_hwnd, out RECT cr)) return 1f;
        int cw = cr.Right - cr.Left;
        return cw > 0 && Screen.width > 0 ? cw / (float)Screen.width : 1f;
    }

    int GetBorderLeft()
    {
        if (!GetWindowRect(_hwnd, out RECT wr)) return 0;
        POINT pt = new POINT();
        ClientToScreen(_hwnd, ref pt);
        return pt.X - wr.Left;
    }

    bool TryAvatarBounds(out float minX, out float maxX)
    {
        minX = 0; maxX = Screen.width;
        if (_renderers == null || _renderers.Length == 0) return false;
        Camera cam = boundsCamera != null ? boundsCamera : Camera.main;
        if (cam == null) return false;
        float lo = float.MaxValue, hi = float.MinValue;
        bool any = false;
        foreach (var rr in _renderers)
        {
            if (rr == null) continue;
            Bounds b = rr.bounds; Vector3 c = b.center, e = b.extents;
            _corners[0]=new Vector3(c.x-e.x,c.y-e.y,c.z-e.z); _corners[1]=new Vector3(c.x-e.x,c.y-e.y,c.z+e.z);
            _corners[2]=new Vector3(c.x-e.x,c.y+e.y,c.z-e.z); _corners[3]=new Vector3(c.x-e.x,c.y+e.y,c.z+e.z);
            _corners[4]=new Vector3(c.x+e.x,c.y-e.y,c.z-e.z); _corners[5]=new Vector3(c.x+e.x,c.y-e.y,c.z+e.z);
            _corners[6]=new Vector3(c.x+e.x,c.y+e.y,c.z-e.z); _corners[7]=new Vector3(c.x+e.x,c.y+e.y,c.z+e.z);
            foreach (var corner in _corners)
            {
                Vector3 sp = cam.WorldToScreenPoint(corner);
                if (sp.z <= 0) continue;
                any = true;
                if (sp.x < lo) lo = sp.x;
                if (sp.x > hi) hi = sp.x;
            }
        }
        if (!any) return false;
        minX = Mathf.Clamp(lo, 0, Screen.width);
        maxX = Mathf.Clamp(hi, 0, Screen.width);
        return true;
    }
}
