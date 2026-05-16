using UnityEngine;
using System;
using System.Collections;
using Kirurobo;

#if UNITY_2018_1_OR_NEWER
using UnityEngine.Networking;
#endif

/// <summary>
/// Detects right-click on the pet and notifies Electron to show the context menu.
///
/// Why pixel-alpha sampling instead of Physics.RaycastAll:
///   UniWindowController hitTestType=Opacity makes transparent pixels click-through
///   for the LEFT button only — right-click still fires on transparent areas.
///   VRM models have no Unity Physics Colliders (only SpringBone logical colliders),
///   so raycasting is unreliable. Sampling the rendered alpha is the same test that
///   UniWindowController itself uses for left-click hit-testing.
///
/// Why LateUpdate instead of Update:
///   Calling cam.Render() inside Update() causes the camera to render twice per frame
///   (once manually, once by Unity's render loop). Moving the readback to LateUpdate
///   lets Unity's normal render pass complete first; we then blit the result into our
///   RenderTexture without triggering a second full render.
/// </summary>
public class PetContextMenu : MonoBehaviour
{
    private const string ElectronMenuUrl = "http://127.0.0.1:8767/menu";

    // Pixels with alpha below this are considered transparent (not over the model).
    private const float AlphaThreshold = 0.1f;

    private RenderTexture _rt;
    private Texture2D _readTex;

    // Pending right-click to process in LateUpdate (set in Update, consumed in LateUpdate).
    private bool _pendingRightClick = false;

    void Start()
    {
        _readTex = new Texture2D(1, 1, TextureFormat.RGBA32, false);
    }

    void OnDestroy()
    {
        if (_rt != null) { _rt.Release(); Destroy(_rt); }
        if (_readTex != null) Destroy(_readTex);
    }

    void Update()
    {
        if (Input.GetMouseButtonDown(1))
            _pendingRightClick = true;
    }

    /// <summary>
    /// LateUpdate runs after Unity's render loop has finished for this frame.
    /// We blit the camera's current render result into our RT here to avoid
    /// triggering a redundant cam.Render() call.
    /// </summary>
    void LateUpdate()
    {
        if (!_pendingRightClick) return;
        _pendingRightClick = false;

        if (!IsOverOpaquePetPixel()) return;

        Vector2 mouse = Input.mousePosition;
        int x = Mathf.RoundToInt(mouse.x);
        int y = Mathf.RoundToInt(Screen.height - mouse.y); // flip Y for screen coords

        var uwc = UniWindowController.current;
        int wx = 0, wy = 0, ww = Screen.width, wh = Screen.height;
        if (uwc != null)
        {
            wx = Mathf.RoundToInt(uwc.windowPosition.x);
            wy = Mathf.RoundToInt(uwc.windowPosition.y);
            ww = Mathf.RoundToInt(uwc.windowSize.x);
            wh = Mathf.RoundToInt(uwc.windowSize.y);
            x += wx;
            y += wy;
        }

        StartCoroutine(PostMenu(x, y, wx, wy, ww, wh));
    }

    /// <summary>
    /// Samples the pixel under the cursor from the camera's last rendered frame.
    /// Uses Graphics.Blit (not cam.Render) to avoid a double-render.
    /// In the Editor, UniWindowController is not active so the window is not
    /// transparent — we skip the check and always return true so right-clicks
    /// work during development.
    /// </summary>
    private bool IsOverOpaquePetPixel()
    {
#if UNITY_EDITOR
        // In the Editor the window is opaque (StartupController is #if !UNITY_EDITOR),
        // so alpha sampling would always return 1. Skip the check entirely.
        return true;
#else
        Camera cam = Camera.main;
        if (cam == null) return true;

        int sw = Screen.width;
        int sh = Screen.height;
        if (sw <= 0 || sh <= 0) return true;

        // Ensure our RenderTexture matches the current screen size.
        if (_rt == null || _rt.width != sw || _rt.height != sh)
        {
            if (_rt != null) { _rt.Release(); Destroy(_rt); }
            _rt = new RenderTexture(sw, sh, 0, RenderTextureFormat.ARGB32);
        }

        // Blit the camera's current render target into our RT.
        // This copies what was already rendered this frame — no second cam.Render() needed.
        RenderTexture source = cam.targetTexture != null ? cam.targetTexture : null;
        if (source != null)
        {
            Graphics.Blit(source, _rt);
        }
        else
        {
            // Camera renders to the back buffer; we need to re-render into our RT.
            // This is unavoidable when the camera has no explicit target texture.
            RenderTexture prev = cam.targetTexture;
            cam.targetTexture = _rt;
            try { cam.Render(); }
            catch (Exception e)
            {
                Debug.LogWarning($"[PetContextMenu] cam.Render() failed: {e.Message} — assuming hit");
                cam.targetTexture = prev;
                return true;
            }
            cam.targetTexture = prev;
        }

        // Read back the single pixel under the cursor.
        int px = Mathf.Clamp(Mathf.RoundToInt(Input.mousePosition.x), 0, sw - 1);
        int py = Mathf.Clamp(Mathf.RoundToInt(Input.mousePosition.y), 0, sh - 1);

        RenderTexture prevActive = RenderTexture.active;
        RenderTexture.active = _rt;
        _readTex.ReadPixels(new Rect(px, py, 1, 1), 0, 0, false);
        _readTex.Apply();
        RenderTexture.active = prevActive;

        return _readTex.GetPixel(0, 0).a >= AlphaThreshold;
#endif
    }

    private IEnumerator PostMenu(int x, int y, int wx, int wy, int ww, int wh)
    {
        string json = $"{{\"x\":{x},\"y\":{y},\"wx\":{wx},\"wy\":{wy},\"ww\":{ww},\"wh\":{wh}}}";
        byte[] data = System.Text.Encoding.UTF8.GetBytes(json);

#if UNITY_2018_1_OR_NEWER
        using var req = new UnityWebRequest(ElectronMenuUrl, "POST");
        req.uploadHandler   = new UploadHandlerRaw(data);
        req.downloadHandler = new DownloadHandlerBuffer();
        req.SetRequestHeader("Content-Type", "application/json");
        yield return req.SendWebRequest();

        if (req.result != UnityWebRequest.Result.Success)
            Debug.LogWarning($"[PetContextMenu] POST failed: {req.error}");
#else
        // Fallback for older Unity versions
        using var client = new System.Net.WebClient();
        client.Headers[System.Net.HttpRequestHeader.ContentType] = "application/json";
        try { client.UploadData(new System.Uri(ElectronMenuUrl), "POST", data); }
        catch (System.Exception e) { Debug.LogWarning($"[PetContextMenu] POST failed: {e.Message}"); }
        yield break;
#endif
    }
}
