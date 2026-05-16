using System.IO;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.UI;
using VRM;
using UniGLTF;
using SFB;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using UniVRM10;
using System;
using Newtonsoft.Json;

public class VRMLoader : MonoBehaviour
{
    public static VRMLoader Instance { get; private set; }

    public Button loadVRMButton;
    public GameObject mainModel;
    public GameObject customModelOutput;
    public RuntimeAnimatorController animatorController;
    public GameObject componentTemplatePrefab;

    private GameObject currentModel;
    private bool isLoading = false;
    private const string LegacyModelPathKey = "SavedPathModel";
    private RuntimeGltfInstance currentGltf;
    private AssetBundle currentBundle;

    // Generation counter — incremented on every LoadVRM call.
    // FinalizeLoadedModel checks that its generation still matches before
    // touching the scene, so a superseded load silently discards its result.
    private int _loadGeneration = 0;

    /// <summary>
    /// The name of the currently active model.
    /// "DEFAULT AVATAR" when the built-in model is active.
    /// </summary>
    public string CurrentModelName { get; private set; } = "DEFAULT AVATAR";

    /// <summary>
    /// The Transform that custom VRM models are parented under.
    /// LocalHttpServer uses this when VRMLoader.Instance is available so both
    /// components always operate on the same node — preventing stacked models.
    /// </summary>
    public Transform CustomModelParent => customModelOutput != null ? customModelOutput.transform : null;

    void Awake()
    {
        if (Instance != null && Instance != this) { Destroy(gameObject); return; }
        Instance = this;
    }

    void Start()
    {
        string savedPath = SaveLoadHandler.Instance != null
            ? SaveLoadHandler.Instance.data.selectedModelPath
            : null;

        if (string.IsNullOrEmpty(savedPath) && PlayerPrefs.HasKey(LegacyModelPathKey))
        {
            savedPath = PlayerPrefs.GetString(LegacyModelPathKey);
            if (SaveLoadHandler.Instance != null)
            {
                SaveLoadHandler.Instance.data.selectedModelPath = savedPath;
                SaveLoadHandler.Instance.SaveToDisk();
            }
            PlayerPrefs.DeleteKey(LegacyModelPathKey);
            PlayerPrefs.Save();
        }
        if (!string.IsNullOrEmpty(savedPath))
            LoadVRM(savedPath);
    }

    public void OpenFileDialogAndLoadVRM()
    {
        if (isLoading) return;

        isLoading = true;
        var extensions = new[] { new ExtensionFilter("Model Files", "vrm", "me", "prefab") };
        string[] paths = StandaloneFileBrowser.OpenFilePanel("Select Model File", "", extensions, false);
        if (paths.Length > 0 && !string.IsNullOrEmpty(paths[0]))
            LoadVRM(paths[0]);

        isLoading = false;
    }

    public async void LoadVRM(string path)
    {
        // Bump the generation counter. Any in-flight load with an older
        // generation will discard its result when it reaches FinalizeLoadedModel.
        int myGeneration = ++_loadGeneration;

        if (path.EndsWith(".me", StringComparison.OrdinalIgnoreCase))
        {
            if (_loadGeneration != myGeneration) return;
            LoadAssetBundleModel(path);
            if (SaveLoadHandler.Instance != null)
            {
                SaveLoadHandler.Instance.data.selectedModelPath = path;
                SaveLoadHandler.Instance.SaveToDisk();
            }
            return;
        }

        if (IsDLCReference(path))
        {
            if (_loadGeneration != myGeneration) return;
            GameObject prefab = FindDLCByName(path);
            if (prefab != null)
            {
                GameObject instance = Instantiate(prefab);
                FinalizeLoadedModel(instance, path, myGeneration);
                if (SaveLoadHandler.Instance != null)
                {
                    SaveLoadHandler.Instance.data.selectedModelPath = path;
                    SaveLoadHandler.Instance.SaveToDisk();
                }
            }
            else
            {
                Debug.LogError("[VRMLoader] DLC Prefab not found: " + path);
            }
            return;
        }

        if (!File.Exists(path)) return;

        try
        {
            byte[] fileData = await Task.Run(() => File.ReadAllBytes(path));

            // Check generation after every await — a newer LoadVRM may have started
            if (_loadGeneration != myGeneration)
            {
                Debug.Log($"[VRMLoader] Load superseded (gen {myGeneration} < {_loadGeneration}), discarding.");
                return;
            }
            if (fileData == null || fileData.Length == 0) return;

            GameObject loadedModel = null;

            // ── VRM 1.x ───────────────────────────────────────────────────────
            try
            {
                var glbData = new GlbFileParser(path).Parse();
                var vrm10Data = Vrm10Data.Parse(glbData);
                if (vrm10Data != null)
                {
                    using var importer10 = new Vrm10Importer(vrm10Data);
                    var instance10 = await importer10.LoadAsync(new ImmediateCaller());
                    if (instance10.Root != null)
                    {
                        loadedModel = instance10.Root;
                        currentGltf = instance10;
                        loadedModel.AddComponent<GltfInstanceDisposer>().Bind(instance10);
                    }
                }
            }
            catch { }

            if (_loadGeneration != myGeneration)
            {
                if (loadedModel != null) Destroy(loadedModel);
                Debug.Log($"[VRMLoader] Load superseded after VRM1 parse (gen {myGeneration}), discarding.");
                return;
            }

            // ── VRM 0.x fallback ──────────────────────────────────────────────
            if (loadedModel == null)
            {
                try
                {
                    // Do NOT use "using var" here — the parsed data must outlive
                    // the await inside LoadAsync, otherwise it gets disposed early.
                    var gltfData = new GlbBinaryParser(fileData, path).Parse();
                    VRMImporterContext importer = null;
                    try
                    {
                        importer = new VRMImporterContext(new VRMData(gltfData));
                        var instance = await importer.LoadAsync(new ImmediateCaller());
                        if (instance.Root != null)
                        {
                            loadedModel = instance.Root;
                            currentGltf = instance;
                            loadedModel.AddComponent<GltfInstanceDisposer>().Bind(instance);
                        }
                    }
                    finally
                    {
                        importer?.Dispose();
                        gltfData?.Dispose();
                    }
                }
                catch { return; }
            }

            if (_loadGeneration != myGeneration)
            {
                if (loadedModel != null) Destroy(loadedModel);
                Debug.Log($"[VRMLoader] Load superseded after VRM0 parse (gen {myGeneration}), discarding.");
                return;
            }

            if (loadedModel == null) return;

            FinalizeLoadedModel(loadedModel, path, myGeneration);
            if (SaveLoadHandler.Instance != null)
            {
                SaveLoadHandler.Instance.data.selectedModelPath = path;
                SaveLoadHandler.Instance.SaveToDisk();
            }
        }
        catch (Exception ex)
        {
            Debug.LogError("[VRMLoader] Failed to load model: " + ex.Message);
        }
    }

    private void LoadAssetBundleModel(string path)
    {
        var bundle = AssetBundle.LoadFromFile(path);
        if (bundle == null)
        {
            Debug.LogError("[VRMLoader] Failed to load AssetBundle at: " + path);
            return;
        }

        var prefab = bundle.LoadAllAssets<GameObject>().FirstOrDefault();
        if (prefab == null)
        {
            Debug.LogError("[VRMLoader] No prefab found in AssetBundle.");
            bundle.Unload(true);
            return;
        }

        var instance = Instantiate(prefab);
        FinalizeLoadedModel(instance, path, _loadGeneration, bundle);
    }

    private void FinalizeLoadedModel(GameObject loadedModel, string path, int generation, AssetBundle bundle = null)
    {
        // Final generation check — this is the last line of defence against
        // two concurrent loads both reaching this synchronous section.
        // If our generation is stale, destroy the freshly-loaded object and bail.
        if (_loadGeneration != generation)
        {
            Debug.LogWarning($"[VRMLoader] FinalizeLoadedModel: generation mismatch ({generation} vs {_loadGeneration}), destroying stale model.");
            if (loadedModel != null) Destroy(loadedModel);
            return;
        }

        // ── 1. Nuke EVERYTHING under customModelOutput except mainModel ────────
        // Do this unconditionally — even if currentModel is null, there may be
        // stale objects from a previous session or a concurrent load that slipped
        // through before the generation check above.
        ForceDestroyAllCustomModels();
        DisableMainModel();

        currentBundle = bundle;

        // ── 2. Parent and zero-out ────────────────────────────────────────────
        loadedModel.transform.SetParent(customModelOutput.transform, false);
        loadedModel.transform.localPosition = Vector3.zero;
        loadedModel.transform.localRotation = Quaternion.identity;
        // Apply saved avatar size — do NOT hardcode Vector3.one or the
        // scroll-wheel scale will be lost for custom VRM models.
        float savedSize = SaveLoadHandler.Instance != null
            ? SaveLoadHandler.Instance.data.avatarSize
            : 1f;
        loadedModel.transform.localScale = Vector3.one * savedSize;
        currentModel = loadedModel;

        // ── 3. Enable all SMRs + prevent off-screen bone freeze ───────────────
        foreach (var smr in currentModel.GetComponentsInChildren<SkinnedMeshRenderer>(true))
        {
            smr.enabled = true;
            smr.updateWhenOffscreen = true;
        }

        // ── 4. Animator: full rewire cycle ────────────────────────────────────
        AssignAnimatorController(currentModel);

        // ── 5. Inject extra components from template prefab ───────────────────
        InjectComponentsFromPrefab(componentTemplatePrefab, currentModel);

        // ── 6. Track model name ───────────────────────────────────────────────
        CurrentModelName = Path.GetFileNameWithoutExtension(path);
        Debug.Log($"[VRMLoader] Loaded: {CurrentModelName} (gen {generation})");

        StartCoroutine(ReleaseRamAndUnloadAssetsCo());
    }

    /// <summary>
    /// Immediately destroys ALL children of customModelOutput except mainModel.
    /// Unlike ClearPreviousCustomModel, this does NOT rely on currentModel being
    /// set — it scans the actual scene hierarchy, so it catches any stale objects
    /// regardless of how they got there.
    /// </summary>
    private void ForceDestroyAllCustomModels()
    {
        if (customModelOutput == null) return;

        var toDestroy = new List<GameObject>();
        foreach (Transform child in customModelOutput.transform)
        {
            if (mainModel != null && child.gameObject == mainModel) continue;
            toDestroy.Add(child.gameObject);
        }

        if (toDestroy.Count > 0)
            Debug.Log($"[VRMLoader] ForceDestroyAllCustomModels: destroying {toDestroy.Count} object(s).");

        foreach (var go in toDestroy)
        {
            CleanupRawImages(go);
            Destroy(go);
        }

        if (currentBundle != null)
        {
            currentBundle.Unload(true);
            currentBundle = null;
        }

        currentGltf = null;
        currentModel = null;

        CleanupAllRawImagesInScene();
    }

    public Texture2D MakeReadableCopy(Texture texture)
    {
        if (texture == null) return null;
        RenderTexture rt = RenderTexture.GetTemporary(texture.width, texture.height, 0);
        Graphics.Blit(texture, rt);
        RenderTexture previous = RenderTexture.active;
        RenderTexture.active = rt;
        Texture2D readable = new Texture2D(texture.width, texture.height, TextureFormat.RGBA32, false);
        readable.ReadPixels(new Rect(0, 0, rt.width, rt.height), 0, 0);
        readable.Apply();
        RenderTexture.active = previous;
        RenderTexture.ReleaseTemporary(rt);
        return readable;
    }

    public void ResetModel()
    {
        // Bump generation so any in-flight load discards its result
        _loadGeneration++;

        string vrmFolder = Path.Combine(Application.persistentDataPath, "VRM");
        if (Directory.Exists(vrmFolder))
            Directory.Delete(vrmFolder, true);

        ForceDestroyAllCustomModels();
        EnableMainModel();

        CurrentModelName = "DEFAULT AVATAR";

        if (SaveLoadHandler.Instance != null)
        {
            SaveLoadHandler.Instance.data.selectedModelPath = "";
            SaveLoadHandler.Instance.SaveToDisk();
        }

        StartCoroutine(ReleaseRamAndUnloadAssetsCo());
    }

    private void DisableMainModel()
    {
        if (mainModel != null)
            mainModel.SetActive(false);
    }

    private void EnableMainModel()
    {
        if (mainModel != null)
            mainModel.SetActive(true);
    }

    // Kept for backward compatibility — callers outside this class may use it.
    // Internally we now use ForceDestroyAllCustomModels.
    private void ClearPreviousCustomModel(bool skipRawImageCleanup = false)
    {
        if (customModelOutput != null)
        {
            var toDestroy = new List<GameObject>();
            foreach (Transform child in customModelOutput.transform)
            {
                if (child.gameObject == mainModel) continue;
                toDestroy.Add(child.gameObject);
            }
            foreach (var go in toDestroy)
            {
                CleanupRawImages(go);
                Destroy(go);
            }
        }

        if (currentBundle != null)
        {
            currentBundle.Unload(true);
            currentBundle = null;
        }

        currentGltf = null;
        currentModel = null;

        if (!skipRawImageCleanup)
            CleanupAllRawImagesInScene();
    }

    private void AssignAnimatorController(GameObject model)
    {
        var animator = model.GetComponentInChildren<Animator>();
        if (animator == null || animatorController == null) return;

        animator.enabled = false;
        animator.runtimeAnimatorController = animatorController;
        animator.enabled = true;
        animator.Rebind();
        animator.Update(0f);
    }

    private void InjectComponentsFromPrefab(GameObject prefabTemplate, GameObject targetModel)
    {
        if (prefabTemplate == null || targetModel == null) return;

        var templateObj = Instantiate(prefabTemplate);
        var animator = targetModel.GetComponentInChildren<Animator>();

        foreach (var templateComp in templateObj.GetComponents<MonoBehaviour>())
        {
            var type = templateComp.GetType();
            if (targetModel.GetComponent(type) != null) continue;
            var newComp = targetModel.AddComponent(type);
            CopyComponentValues(templateComp, newComp);

            if (animator != null)
            {
                var setAnimMethod = type.GetMethod("SetAnimator", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
                if (setAnimMethod != null) setAnimMethod.Invoke(newComp, new object[] { animator });

                var animatorField = type.GetField("animator", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
                if (animatorField != null && animatorField.FieldType == typeof(Animator)) animatorField.SetValue(newComp, animator);
            }
        }
        Destroy(templateObj);
    }

    private void CopyComponentValues(Component source, Component destination)
    {
        var type = source.GetType();
        var fields = type.GetFields(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
        foreach (var field in fields)
        {
            if (field.IsDefined(typeof(SerializeField), true) || field.IsPublic)
                field.SetValue(destination, field.GetValue(source));
        }
        var props = type.GetProperties(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance)
                        .Where(p => p.CanWrite && p.GetSetMethod(true) != null);
        foreach (var prop in props)
        {
            try { prop.SetValue(destination, prop.GetValue(source)); }
            catch { }
        }
    }

    public int GetTotalPolygons(GameObject model)
    {
        int total = 0;
        foreach (var meshFilter in model.GetComponentsInChildren<MeshFilter>(true))
        {
            var mesh = meshFilter.sharedMesh;
            if (mesh != null)
                total += mesh.triangles.Length / 3;
        }
        foreach (var skinned in model.GetComponentsInChildren<SkinnedMeshRenderer>(true))
        {
            var mesh = skinned.sharedMesh;
            if (mesh != null)
                total += mesh.triangles.Length / 3;
        }
        return total;
    }

    public void ActivateDefaultModel()
    {
        _loadGeneration++;
        ForceDestroyAllCustomModels();
        EnableMainModel();

        CurrentModelName = "DEFAULT AVATAR";

        if (SaveLoadHandler.Instance != null)
        {
            SaveLoadHandler.Instance.data.selectedModelPath = "";
            SaveLoadHandler.Instance.SaveToDisk();
        }

        StartCoroutine(ReleaseRamAndUnloadAssetsCo());
    }

    private System.Collections.IEnumerator ReleaseRamAndUnloadAssetsCo()
    {
        yield return Resources.UnloadUnusedAssets();
        yield return null;
        System.GC.Collect();
        System.GC.WaitForPendingFinalizers();
        System.GC.Collect();
    }

    private void CleanupRawImages(GameObject obj)
    {
        if (obj == null) return;
        var rawImages = obj.GetComponentsInChildren<RawImage>(true);
        foreach (var rawImage in rawImages)
            rawImage.texture = null;
    }

    private void CleanupAllRawImagesInScene()
    {
        var rawImages = GameObject.FindObjectsByType<RawImage>(FindObjectsInactive.Include, FindObjectsSortMode.None);
        foreach (var rawImage in rawImages)
            rawImage.texture = null;
    }

    private bool IsDLCReference(string path)
    {
#if UNITY_EDITOR
        if (path.EndsWith(".prefab", StringComparison.OrdinalIgnoreCase))
            return true;
#endif
        if (!File.Exists(path) && !path.EndsWith(".vrm") && !path.EndsWith(".me"))
            return true;
        return false;
    }

    private GameObject FindDLCByName(string name)
    {
        return null;
    }

    public GameObject GetCurrentModel()
    {
        return currentModel;
    }
}

public sealed class GltfInstanceDisposer : MonoBehaviour
{
    private UniGLTF.RuntimeGltfInstance inst;

    public void Bind(UniGLTF.RuntimeGltfInstance i)
    {
        inst = i;
    }

    private void OnDestroy()
    {
        try { inst?.Dispose(); } catch { }
    }
}
