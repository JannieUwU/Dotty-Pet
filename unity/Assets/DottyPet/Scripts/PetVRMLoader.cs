using System;
using System.IO;
using UnityEngine;
using UniGLTF;
using UniVRM10;

/// <summary>
/// VRM loader for DottyPet. Handles VRM 0.x and VRM 1.0 via the unified
/// Vrm10.LoadPathAsync API (canLoadVrm0X: true).
///
/// Swap pattern (no visual gap, no frozen animations):
///   1. Load new model with showMeshes:false  → hidden, no T-pose flash
///   2. Assign AnimatorController + full Rebind cycle
///   3. Make visible + set updateWhenOffscreen on all SMRs
///   4. Destroy old instance  → GltfInstanceDisposer auto-cleans GPU assets
///   5. RewireControllers()   → PetController + PetAnimatorController follow new model
/// </summary>
public class PetVRMLoader : MonoBehaviour
{
    public static PetVRMLoader Instance { get; private set; }

    [Header("Scene refs")]
    public GameObject                defaultModel;
    public Transform                 modelParent;
    public RuntimeAnimatorController animatorController;

    [Header("Controllers to re-wire on model swap")]
    public PetAnimatorController petAnimatorController;

    public string CurrentModelName { get; private set; } = "DEFAULT AVATAR";

    const string PrefKey = "DottyPet_ModelPath";

    // Tracks the currently loaded VRM instance (null when on default model).
    Vrm10Instance _currentVrm;

    void Awake()
    {
        if (Instance != null && Instance != this) { Destroy(gameObject); return; }
        Instance = this;
    }

    void Start()
    {
        // PetVRMLoader is NOT used in the main scene — VRMLoader is the active
        // loader. This Start() is intentionally left empty to prevent auto-loading
        // from PlayerPrefs, which would cause a second model to appear on top of
        // the one loaded by VRMLoader.
        //
        // If you need to re-enable this loader, wire it up in the scene and
        // remove VRMLoader, or merge the two systems.
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /// <summary>
    /// Loads a VRM file (0.x or 1.0) and swaps it in as the active model.
    /// Safe to call from any context — all Unity API calls happen on the main thread.
    /// </summary>
    public async void LoadVRM(string path)
    {
        if (!File.Exists(path))
        {
            Debug.LogError("[PetVRMLoader] File not found: " + path);
            return;
        }

        Vrm10Instance newInstance = null;
        try
        {
            // Unified API — handles both VRM 0.x and VRM 1.0.
            // showMeshes:false keeps the model invisible until we finish setup,
            // preventing the T-pose flash between destroy-old and show-new.
            newInstance = await Vrm10.LoadPathAsync(
                path,
                canLoadVrm0X: true,
                showMeshes: false,
                awaitCaller: new ImmediateCaller()
            );
        }
        catch (Exception e)
        {
            Debug.LogError("[PetVRMLoader] Load failed: " + e.Message);
            // Clean up the partially-loaded instance if one was created
            if (newInstance != null) Destroy(newInstance.gameObject);
            return;
        }

        if (newInstance == null)
        {
            Debug.LogError("[PetVRMLoader] Vrm10.LoadPathAsync returned null for: " + path);
            return;
        }

        Finalize(newInstance, path);
    }

    /// <summary>
    /// Destroys the current VRM and restores the built-in default model.
    /// </summary>
    public void ResetToDefault()
    {
        ClearCurrent();

        if (defaultModel) defaultModel.SetActive(true);

        var defaultAnim = defaultModel ? defaultModel.GetComponentInChildren<Animator>() : null;
        if (defaultAnim != null) RewireControllers(defaultAnim);

        CurrentModelName = "DEFAULT AVATAR";
        PlayerPrefs.DeleteKey(PrefKey);
        PlayerPrefs.Save();
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    void Finalize(Vrm10Instance newInstance, string path)
    {
        var root = newInstance.gameObject;

        // ── 1. Parent and zero-out ────────────────────────────────────────────
        root.transform.SetParent(modelParent != null ? modelParent : transform, false);
        root.transform.SetLocalPositionAndRotation(Vector3.zero, Quaternion.identity);
        root.transform.localScale = Vector3.one;

        // ── 2. Animator: full rewire cycle ────────────────────────────────────
        // disable → assign controller → enable → Rebind() → Update(0)
        // Must happen before ShowMeshes so the first visible frame is in the
        // correct pose, not the T-pose.
        var newAnim = root.GetComponentInChildren<Animator>();
        if (newAnim != null && animatorController != null)
        {
            newAnim.enabled = false;
            newAnim.runtimeAnimatorController = animatorController;
            newAnim.enabled = true;
            newAnim.Rebind();
            newAnim.Update(0f);
        }

        // ── 3. Destroy old AFTER new is ready (no visual gap) ─────────────────
        // UniVRM attaches GltfInstanceDisposer automatically via LoadPathAsync,
        // so Destroy(gameObject) correctly releases all GPU assets.
        ClearCurrent();

        // ── 4. Hide default model ─────────────────────────────────────────────
        if (defaultModel) defaultModel.SetActive(false);

        // ── 5. Make visible + prevent off-screen bone freeze ─────────────────
        // updateWhenOffscreen = true is critical: without it, SkinnedMeshRenderer
        // stops updating bone transforms when the model's bounding box leaves the
        // camera frustum — causing animations to freeze on a desktop pet that
        // sits at the screen edge.
        foreach (var smr in root.GetComponentsInChildren<SkinnedMeshRenderer>(true))
        {
            smr.enabled = true;
            smr.updateWhenOffscreen = true;
        }

        // ── 6. Re-wire controllers ────────────────────────────────────────────
        if (newAnim != null) RewireControllers(newAnim);

        _currentVrm = newInstance;
        CurrentModelName = Path.GetFileNameWithoutExtension(path);
        PlayerPrefs.SetString(PrefKey, path);
        PlayerPrefs.Save();

        StartCoroutine(UnloadUnused());
        Debug.Log($"[PetVRMLoader] Loaded: {CurrentModelName}");
    }

    /// <summary>
    /// Points PetController and PetAnimatorController at <paramref name="anim"/>.
    /// Called after every model swap (including reset-to-default).
    /// </summary>
    void RewireControllers(Animator anim)
    {
        var pc = PetController.Instance;
        if (pc != null) pc.SetAnimator(anim);

        if (petAnimatorController != null) petAnimatorController.SetAnimator(anim);
    }

    void ClearCurrent()
    {
        if (_currentVrm != null)
        {
            Destroy(_currentVrm.gameObject);
            _currentVrm = null;
        }
    }

    System.Collections.IEnumerator UnloadUnused()
    {
        yield return Resources.UnloadUnusedAssets();
        GC.Collect();
    }
}
