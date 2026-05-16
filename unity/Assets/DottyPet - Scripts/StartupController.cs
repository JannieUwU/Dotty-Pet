using UnityEngine;

#if !UNITY_EDITOR
using Kirurobo;
#endif

/// <summary>
/// Configures the Unity window as a transparent, always-on-top desktop overlay
/// on application startup. Attach to a persistent GameObject in DottyPet Main scene.
/// Only active in Standalone builds — Editor mode is skipped intentionally.
/// </summary>
public class StartupController : MonoBehaviour
{
    [Header("Window Settings")]
    [Tooltip("Make window background transparent")]
    [SerializeField] private bool startTransparent = true;

    [Tooltip("Keep window above all other windows")]
    [SerializeField] private bool startTopmost = true;

    [Header("Initial Position")]
    [Tooltip("Remember window position between sessions")]
    [SerializeField] private bool rememberPosition = true;

    [Tooltip("Normalized screen position (0-1) used when no saved position exists. " +
             "(0.75, 0.1) = right side, near top")]
    [SerializeField] private Vector2 defaultScreenAnchor = new Vector2(0.75f, 0.1f);

    private const string PrefKeyX = "DottyPet_WinX";
    private const string PrefKeyY = "DottyPet_WinY";

#if !UNITY_EDITOR
    private UniWindowController _uwc;
#endif

    private void Awake()
    {
        // Essential: keep running when window loses focus
        Application.runInBackground = true;

#if UNITY_EDITOR
        // Transparent overlay is not possible in Editor — skip silently
        Debug.Log("[StartupController] Running in Editor — window settings skipped.");
#else
        _uwc = UniWindowController.current
               ?? FindObjectOfType<UniWindowController>();

        if (_uwc == null)
        {
            Debug.LogError("[StartupController] UniWindowController not found in scene. " +
                           "Please add it to the main scene.");
            return;
        }

        ApplyWindowSettings();
        RestoreOrSetDefaultPosition();
#endif
    }

#if !UNITY_EDITOR
    private void ApplyWindowSettings()
    {
        // Force camera background to transparent black BEFORE enabling transparency,
        // so UniWindowController records Color.clear as the originalCameraBackground.
        // This prevents any colored flash if autoSwitchCameraBackground ever restores it.
        if (_uwc.currentCamera != null)
        {
            _uwc.currentCamera.clearFlags = UnityEngine.CameraClearFlags.SolidColor;
            _uwc.currentCamera.backgroundColor = Color.clear;
        }

        // Transparent alpha-blended window (per-pixel alpha)
        _uwc.transparentType = UniWindowController.TransparentType.Alpha;
        _uwc.isTransparent   = startTransparent;

        // Always on top of other windows
        _uwc.isTopmost = startTopmost;

        // Click-through on transparent pixels, clickable on character pixels
        _uwc.hitTestType = UniWindowController.HitTestType.Opacity;

        Debug.Log("[StartupController] Window configured: transparent=" + startTransparent +
                  " topmost=" + startTopmost);
    }

    private void RestoreOrSetDefaultPosition()
    {
        if (rememberPosition && PlayerPrefs.HasKey(PrefKeyX))
        {
            float x = PlayerPrefs.GetFloat(PrefKeyX);
            float y = PlayerPrefs.GetFloat(PrefKeyY);
            _uwc.windowPosition = new Vector2(x, y);
            Debug.Log($"[StartupController] Restored position: ({x}, {y})");
        }
        else
        {
            PlaceAtDefaultAnchor();
        }
    }

    private void PlaceAtDefaultAnchor()
    {
        // Get primary monitor rect
        Rect monitor = UniWindowController.GetMonitorRect(0);

        // Window size
        Vector2 winSize = _uwc.windowSize;

        // Calculate pixel position from normalized anchor
        float x = monitor.x + monitor.width  * defaultScreenAnchor.x;
        float y = monitor.y + monitor.height * (1f - defaultScreenAnchor.y) - winSize.y;

        _uwc.windowPosition = new Vector2(x, y);
        Debug.Log($"[StartupController] Default position: ({x}, {y})");
    }

    private void OnApplicationQuit()
    {
        if (!rememberPosition || _uwc == null) return;

        Vector2 pos = _uwc.windowPosition;
        PlayerPrefs.SetFloat(PrefKeyX, pos.x);
        PlayerPrefs.SetFloat(PrefKeyY, pos.y);
        PlayerPrefs.Save();
        Debug.Log($"[StartupController] Saved position: ({pos.x}, {pos.y})");
    }
#endif
}
