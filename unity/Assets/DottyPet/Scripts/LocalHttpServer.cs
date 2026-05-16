using UnityEngine;
using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Concurrent;
using System.Collections;
using System.Linq;
using VRM;
using UniGLTF;
using UniVRM10;
using Kirurobo;

/// <summary>
/// Embedded HTTP server on port 8765.
/// Handles VRM loading directly — no dependency on VRMLoader component.
/// </summary>
public class LocalHttpServer : MonoBehaviour
{
    [Header("Server")]
    public int port = 8765;

    [Header("Model Setup")]
    public GameObject            mainModel;
    public Transform             modelParent;
    public RuntimeAnimatorController animatorController;

    private GameObject _currentVrmModel;
    private string _currentModelName = "DEFAULT AVATAR";

    /// <summary>Returns the currently loaded custom VRM model, or null if on default.</summary>
    public GameObject GetCurrentVrmModel() => _currentVrmModel;

    private HttpListener _listener;
    private Thread _thread;
    private readonly ConcurrentQueue<Action> _mainThreadQueue = new();

    void OnEnable()
    {
        _listener = new HttpListener();
        _listener.Prefixes.Add($"http://127.0.0.1:{port}/");
        _listener.Start();
        _thread = new Thread(Listen) { IsBackground = true, Name = "LocalHttpServer" };
        _thread.Start();
        Debug.Log($"[LocalHttpServer] Listening on port {port}");
    }

    void OnDisable()
    {
        _listener?.Stop();
        _listener?.Close();
        _listener = null;
    }

    void Update()
    {
        while (_mainThreadQueue.TryDequeue(out var action))
            action?.Invoke();
    }

    // ── HTTP ──────────────────────────────────────────────────────────────────

    private void Listen()
    {
        var listener = _listener;
        while (listener != null && listener.IsListening)
        {
            try
            {
                var ctx = listener.GetContext();
                ThreadPool.QueueUserWorkItem(_ => HandleRequest(ctx));
            }
            catch (HttpListenerException) { break; }
            catch (ObjectDisposedException) { break; }
            catch (Exception e) { Debug.LogWarning($"[LocalHttpServer] {e.Message}"); }
        }
    }

    private void HandleRequest(HttpListenerContext ctx)
    {
        var req = ctx.Request;
        var res = ctx.Response;
        res.Headers.Add("Access-Control-Allow-Origin", "*");
        res.ContentType = "application/json";
        try
        {
            string body = "";
            if (req.HasEntityBody)
                using (var sr = new StreamReader(req.InputStream, req.ContentEncoding))
                    body = sr.ReadToEnd();

            string responseJson = Route(req.HttpMethod, req.Url.AbsolutePath, body);
            byte[] buf = Encoding.UTF8.GetBytes(responseJson);
            res.ContentLength64 = buf.Length;
            res.OutputStream.Write(buf, 0, buf.Length);
        }
        catch (Exception e)
        {
            byte[] err = Encoding.UTF8.GetBytes($"{{\"error\":\"{e.Message}\"}}");
            res.StatusCode = 500;
            res.OutputStream.Write(err, 0, err.Length);
        }
        finally { res.OutputStream.Close(); }
    }

    private string Route(string method, string path, string body)
    {
        if (method == "GET" && path == "/status")
        {
            var tcs = new TaskCompletionSource<string>();
            _mainThreadQueue.Enqueue(() =>
            {
                var uwc = UniWindowController.current;
                int wx = 0, wy = 0, ww = Screen.width, wh = Screen.height;
                if (uwc != null)
                {
                    wx = Mathf.RoundToInt(uwc.windowPosition.x);
                    wy = Mathf.RoundToInt(uwc.windowPosition.y);
                    ww = Mathf.RoundToInt(uwc.windowSize.x);
                    wh = Mathf.RoundToInt(uwc.windowSize.y);
                }
                // Always read model name from VRMLoader if available — it is the
                // single source of truth for which model is currently displayed.
                string modelName = VRMLoader.Instance != null
                    ? VRMLoader.Instance.CurrentModelName
                    : _currentModelName;
                tcs.SetResult($"{{\"state\":\"idle\",\"modelName\":\"{modelName}\",\"wx\":{wx},\"wy\":{wy},\"ww\":{ww},\"wh\":{wh}}}");
            });
            return tcs.Task.Wait(200) ? tcs.Task.Result
                : $"{{\"state\":\"idle\",\"modelName\":\"{_currentModelName}\",\"wx\":0,\"wy\":0,\"ww\":0,\"wh\":0}}";
        }

        if (method == "POST" && path == "/hittest")
        {
            var json = SimpleJson.Parse(body);
            int sx = int.TryParse(json.GetString("sx", "0"), out var _sx) ? _sx : 0;
            int sy = int.TryParse(json.GetString("sy", "0"), out var _sy) ? _sy : 0;
            var tcs = new TaskCompletionSource<bool>();
            _mainThreadQueue.Enqueue(() =>
            {
                var uwc = UniWindowController.current;
                float localX = sx, localY = sy;
                if (uwc != null) { localX = sx - uwc.windowPosition.x; localY = sy - uwc.windowPosition.y; }
                float unityY = Screen.height - localY;
                var ray = Camera.main.ScreenPointToRay(new Vector3(localX, unityY, 0));
                tcs.SetResult(Physics.Raycast(ray));
            });
            bool result = tcs.Task.Wait(200) && tcs.Task.Result;
            return $"{{\"hit\":{(result ? "true" : "false")}}}";
        }

        if (method == "OPTIONS") return "{}";

        if (method == "POST")
        {
            var json = SimpleJson.Parse(body);
            switch (path)
            {
                case "/emotion":
                    string emotion = json.GetString("state", "idle");
                    _mainThreadQueue.Enqueue(() => PetController.Instance?.SetEmotion(emotion));
                    return "{\"ok\":true}";

                case "/animation":
                    string action = json.GetString("action", "");
                    _mainThreadQueue.Enqueue(() => PetController.Instance?.TriggerAnimation(action));
                    return "{\"ok\":true}";

                case "/notification":
                    string message = json.GetString("message", "");
                    _mainThreadQueue.Enqueue(() => PetController.Instance?.ShowNotification(message));
                    return "{\"ok\":true}";

                case "/model":
                    string modelPath = json.GetString("path", "");
                    var modelTcs = new TaskCompletionSource<bool>();
                    _mainThreadQueue.Enqueue(() =>
                    {
                        try
                        {
                            if (string.IsNullOrEmpty(modelPath))
                            {
                                if (VRMLoader.Instance != null)
                                    VRMLoader.Instance.ResetModel();
                                else
                                    StartCoroutine(ResetModelCo());
                            }
                            else
                            {
                                if (VRMLoader.Instance != null)
                                    VRMLoader.Instance.LoadVRM(modelPath);
                                else
                                    StartCoroutine(LoadVrmCo(modelPath));
                            }
                            modelTcs.TrySetResult(true);
                        }
                        catch (Exception ex)
                        {
                            Debug.LogError("[LocalHttpServer] /model error: " + ex.Message);
                            modelTcs.TrySetResult(false);
                        }
                    });
                    bool dispatched = modelTcs.Task.Wait(2000) && modelTcs.Task.Result;
                    return dispatched ? "{\"ok\":true}" : "{\"ok\":false,\"error\":\"dispatch timeout\"}";
            }
        }

        return "{\"error\":\"not found\"}";
    }

    // ── VRM Loading ───────────────────────────────────────────────────────────

    IEnumerator LoadVrmCo(string path)
    {
        Debug.Log($"[LocalHttpServer] Loading VRM: {path}");

        if (!File.Exists(path))
        {
            Debug.LogError("[LocalHttpServer] File not found: " + path);
            yield break;
        }

        // Load file bytes off main thread
        byte[] bytes = null;
        var readTask = Task.Run(() => { try { bytes = File.ReadAllBytes(path); } catch { } });
        yield return new WaitUntil(() => readTask.IsCompleted);

        if (bytes == null || bytes.Length == 0)
        {
            Debug.LogError("[LocalHttpServer] Failed to read file bytes.");
            yield break;
        }

        // Try VRM 1.x first
        GameObject loaded = null;
        Task<GameObject> loadTask = null;
        Exception vrm1Error = null;

        try
        {
            var glbData = new GlbFileParser(path).Parse();
            var vrm10Data = Vrm10Data.Parse(glbData);
            if (vrm10Data != null)
                loadTask = LoadVrm10Async(vrm10Data);
        }
        catch (Exception e) { vrm1Error = e; }

        if (vrm1Error != null)
            Debug.LogWarning("[LocalHttpServer] VRM1 parse failed, trying VRM0: " + vrm1Error.Message);

        if (loadTask != null)
        {
            yield return new WaitUntil(() => loadTask.IsCompleted);
            if (!loadTask.IsFaulted) loaded = loadTask.Result;
        }

        // Fallback: VRM 0.x
        if (loaded == null)
        {
            Exception vrm0Error = null;
            loadTask = null;
            try { loadTask = LoadVrm0Async(bytes, path); }
            catch (Exception e) { vrm0Error = e; }

            if (vrm0Error != null)
            {
                Debug.LogError("[LocalHttpServer] VRM0 load failed: " + vrm0Error.Message);
            }
            else if (loadTask != null)
            {
                yield return new WaitUntil(() => loadTask.IsCompleted);
                if (!loadTask.IsFaulted) loaded = loadTask.Result;
            }
        }

        if (loaded == null)
        {
            Debug.LogError("[LocalHttpServer] Both VRM parsers failed for: " + path);
            yield break;
        }

        FinalizeModel(loaded, path);
    }

    async Task<GameObject> LoadVrm10Async(Vrm10Data vrm10Data)
    {
        using var importer = new Vrm10Importer(vrm10Data);
        var instance = await importer.LoadAsync(new ImmediateCaller());
        if (instance?.Root == null) return null;
        instance.Root.AddComponent<GltfInstanceDisposer>().Bind(instance);
        return instance.Root;
    }

    async Task<GameObject> LoadVrm0Async(byte[] bytes, string path)
    {
        var gltfData = new GlbBinaryParser(bytes, path).Parse();
        VRMImporterContext importer = null;
        try
        {
            importer = new VRMImporterContext(new VRMData(gltfData));
            var instance = await importer.LoadAsync(new ImmediateCaller());
            if (instance?.Root == null) return null;
            instance.Root.AddComponent<GltfInstanceDisposer>().Bind(instance);
            return instance.Root;
        }
        finally
        {
            importer?.Dispose();
            gltfData?.Dispose();
        }
    }

    void FinalizeModel(GameObject loaded, string path)
    {
        // Destroy previous custom VRM tracked by this component
        if (_currentVrmModel != null)
        {
            Destroy(_currentVrmModel);
            _currentVrmModel = null;
        }

        // Also destroy any children of modelParent that aren't the default model
        // — guards against stale objects left by VRMLoader or a previous session.
        // Prefer VRMLoader's customModelOutput so both components always operate
        // on the same scene node — prevents stacked models.
        var parent = (VRMLoader.Instance != null && VRMLoader.Instance.CustomModelParent != null)
            ? VRMLoader.Instance.CustomModelParent
            : (modelParent != null ? modelParent : transform);
        foreach (Transform child in parent)
        {
            if (mainModel != null && child.gameObject == mainModel) continue;
            if (child.gameObject == loaded) continue;
            Destroy(child.gameObject);
        }

        // Hide default model
        if (mainModel != null) mainModel.SetActive(false);

        // Parent and zero-out
        loaded.transform.SetParent(parent, false);
        loaded.transform.SetLocalPositionAndRotation(Vector3.zero, Quaternion.identity);

        // Apply saved avatar size — do NOT hardcode Vector3.one or the scroll-wheel
        // scale will be ignored for custom VRM models.
        float savedSize = SaveLoadHandler.Instance != null
            ? SaveLoadHandler.Instance.data.avatarSize
            : 1f;
        loaded.transform.localScale = Vector3.one * savedSize;

        // Animator rewire: disable → assign → enable → Rebind → Update(0)
        var anim = loaded.GetComponentInChildren<Animator>();
        if (anim != null && animatorController != null)
        {
            anim.enabled = false;
            anim.runtimeAnimatorController = animatorController;
            anim.enabled = true;
            anim.Rebind();
            anim.Update(0f);
        }

        // Enable all SMRs + prevent off-screen freeze
        foreach (var smr in loaded.GetComponentsInChildren<SkinnedMeshRenderer>(true))
        {
            smr.enabled = true;
            smr.updateWhenOffscreen = true;
        }

        _currentVrmModel = loaded;
        _currentModelName = Path.GetFileNameWithoutExtension(path);

        // Save path
        if (SaveLoadHandler.Instance != null)
        {
            SaveLoadHandler.Instance.data.selectedModelPath = path;
            SaveLoadHandler.Instance.SaveToDisk();
        }

        StartCoroutine(UnloadUnused());
        Debug.Log($"[LocalHttpServer] Loaded: {_currentModelName}");
    }

    IEnumerator ResetModelCo()
    {
        if (_currentVrmModel != null)
        {
            Destroy(_currentVrmModel);
            _currentVrmModel = null;
        }

        // Also clear VRMLoader's model if it's running — prevents stale model
        // remaining visible when LocalHttpServer is the one handling the reset.
        if (VRMLoader.Instance != null)
        {
            VRMLoader.Instance.ResetModel();
        }
        else
        {
            if (mainModel != null) mainModel.SetActive(true);
        }

        _currentModelName = "DEFAULT AVATAR";

        if (SaveLoadHandler.Instance != null)
        {
            SaveLoadHandler.Instance.data.selectedModelPath = "";
            SaveLoadHandler.Instance.SaveToDisk();
        }

        Debug.Log("[LocalHttpServer] Reset to default model.");
        yield return null;
    }

    IEnumerator UnloadUnused()
    {
        yield return Resources.UnloadUnusedAssets();
        GC.Collect();
    }
}
