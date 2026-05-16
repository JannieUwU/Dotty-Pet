using UnityEngine;
using NAudio.CoreAudioApi;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;

/// <summary>
/// Controls idle cycling, drag detection, and dance-to-music.
/// The Animator it drives is injected via SetAnimator() by PetVRMLoader
/// after every model swap, so it always targets the active model.
/// </summary>
public class PetAnimatorController : MonoBehaviour
{
    [Header("Idle")]
    public int totalIdleAnimations = 10;
    public float idleSwitchTime = 12f;
    public float idleTransitionTime = 3f;

    [Header("Dance")]
    public bool enableDancing = true;
    public int danceClipCount = 5;
    public float danceSwitchTime = 15f;
    public float danceTransitionTime = 2f;
    public float soundThreshold = 0.02f;
    public List<string> allowedApps = new();

    [Header("Character")]
    public bool husbandoMode = false;

    // animator param hashes
    static readonly int _danceIndex  = Animator.StringToHash("DanceIndex");
    static readonly int _isIdle      = Animator.StringToHash("isIdle");
    static readonly int _isDragging  = Animator.StringToHash("isDragging");
    static readonly int _isDancing   = Animator.StringToHash("isDancing");
    static readonly int _idleIndex   = Animator.StringToHash("IdleIndex");
    static readonly int _isMale      = Animator.StringToHash("isMale");
    static readonly int _isFemale    = Animator.StringToHash("isFemale");

    Animator _anim;
    MMDeviceEnumerator _enum;
    MMDevice _device;

    bool _dragging, _dancing, _mouseHeld;
    float _dragLockTimer, _idleTimer, _danceTimer;
    int _idleState, _danceState;
    float _lastSoundCheck;
    Coroutine _idleCo, _danceCo, _soundCo;

    void OnEnable()
    {
        // _anim may already be set by SetAnimator(); only fall back to
        // GetComponent if it hasn't been injected yet (first startup).
        if (_anim == null) _anim = GetComponent<Animator>();
        Application.runInBackground = true;
        _enum   = new MMDeviceEnumerator();
        _device = _enum.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia);
        if (_anim != null) ApplyGender();
        _soundCo = StartCoroutine(SoundLoop());
    }

    void OnDisable()  => Cleanup();
    void OnDestroy()  => Cleanup();

    void Cleanup()
    {
        if (_soundCo != null) { StopCoroutine(_soundCo); _soundCo = null; }
        if (_idleCo  != null) { StopCoroutine(_idleCo);  _idleCo  = null; }
        if (_danceCo != null) { StopCoroutine(_danceCo); _danceCo = null; }
        _device?.Dispose(); _device = null;
        _enum?.Dispose();   _enum   = null;
    }

    /// <summary>
    /// Called by PetVRMLoader after every model swap.
    /// Redirects all animator parameter writes to the new model's Animator.
    /// </summary>
    public void SetAnimator(Animator anim)
    {
        _anim = anim;
        if (_anim == null) return;

        // Re-apply current state to the new animator immediately
        ApplyGender();
        _anim.SetBool(_isDragging, _dragging);
        _anim.SetBool(_isDancing,  _dancing);
        _anim.SetFloat(_idleIndex, _idleState);
        if (_dancing) _anim.SetFloat(_danceIndex, _danceState);
    }

    void ApplyGender()
    {
        _anim.SetFloat(_isFemale, husbandoMode ? 0f : 1f);
        _anim.SetFloat(_isMale,   husbandoMode ? 1f : 0f);
    }

    // ── Update ────────────────────────────────────────────────────────────────

    void Update()
    {
        if (_anim == null) return;

        ApplyGender();

        // drag
        if (Input.GetMouseButtonDown(0))
        {
            SetDragging(true);
            _mouseHeld = true;
            _dragLockTimer = 0.30f;
            SetDancing(false);
        }
        if (Input.GetMouseButtonUp(0)) _mouseHeld = false;

        if (_dragLockTimer > 0f)
        {
            _dragLockTimer -= Time.deltaTime;
            _anim.SetBool(_isDragging, true);
        }
        else if (!_mouseHeld && _dragging) SetDragging(false);

        // idle cycling
        _idleTimer += Time.deltaTime;
        if (_idleTimer > idleSwitchTime)
        {
            _idleTimer = 0f;
            int next = (_idleState + 1) % totalIdleAnimations;
            if (_idleCo != null) StopCoroutine(_idleCo);
            _idleCo = StartCoroutine(LerpFloat(_idleIndex, next, idleTransitionTime));
            _idleState = next;
        }

        // update isIdle param
        bool inIdle = _anim.GetCurrentAnimatorStateInfo(0).IsName("Idle");
        _anim.SetBool(_isIdle, inIdle);

        // dance cycling
        if (_dancing && enableDancing)
        {
            _danceTimer += Time.deltaTime;
            if (_danceTimer > danceSwitchTime)
            {
                _danceTimer = 0f;
                int next = (_danceState + 1) % danceClipCount;
                if (_danceCo != null) StopCoroutine(_danceCo);
                _danceCo = StartCoroutine(LerpFloat(_danceIndex, next, danceTransitionTime));
                _danceState = next;
            }
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    void SetDragging(bool v) { _dragging = v; _anim.SetBool(_isDragging, v); }

    void SetDancing(bool v)
    {
        _dancing = v;
        _anim.SetBool(_isDancing, v);
        if (!v && _danceCo != null) { StopCoroutine(_danceCo); _danceCo = null; }
    }

    IEnumerator LerpFloat(int hash, float target, float duration)
    {
        float start = _anim.GetFloat(hash), elapsed = 0f;
        while (elapsed < duration)
        {
            elapsed += Time.deltaTime;
            _anim.SetFloat(hash, Mathf.Lerp(start, target, elapsed / duration));
            yield return null;
        }
        _anim.SetFloat(hash, target);
    }

    // ── Sound / dance detection ───────────────────────────────────────────────

    IEnumerator SoundLoop()
    {
        var wait = new WaitForSeconds(2f);
        while (true) { CheckSound(); yield return wait; }
    }

    void CheckSound()
    {
        if (!enableDancing || _dragging) { if (_dancing) SetDancing(false); return; }
        bool playing = IsAllowedAppPlaying();
        if (playing && !_dancing)  { StartDance(); }
        else if (!playing && _dancing) { SetDancing(false); }
    }

    void StartDance()
    {
        _dancing = true;
        _danceTimer = 0f;
        _danceState = Random.Range(0, danceClipCount);
        _anim.SetBool(_isDancing, true);
        _anim.SetFloat(_danceIndex, _danceState);
    }

    bool IsAllowedAppPlaying()
    {
        if (Time.time - _lastSoundCheck < 2f) return _dancing;
        _lastSoundCheck = Time.time;
        try
        {
            _device?.Dispose();
            _device = _enum.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia);
            var sessions = _device.AudioSessionManager.Sessions;
            for (int i = 0; i < sessions.Count; i++)
            {
                var s = sessions[i];
                if (s.AudioMeterInformation.MasterPeakValue <= soundThreshold) continue;
                int pid = (int)s.GetProcessID;
                if (pid == 0) continue;
                try
                {
                    string name = Process.GetProcessById(pid)?.ProcessName;
                    if (string.IsNullOrEmpty(name)) continue;
                    for (int j = 0; j < allowedApps.Count; j++)
                        if (name.StartsWith(allowedApps[j], System.StringComparison.OrdinalIgnoreCase)) return true;
                }
                catch { }
            }
        }
        catch { _device?.Dispose(); _device = null; }
        return false;
    }
}
