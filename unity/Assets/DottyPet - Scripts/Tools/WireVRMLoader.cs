#if UNITY_EDITOR
using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;

/// <summary>
/// Wires LocalHttpServer fields from the existing VRMLoader in the scene.
/// Menu: DottyPet → Wire LocalHttpServer
/// </summary>
public static class WireVRMLoader
{
    [MenuItem("DottyPet/Wire LocalHttpServer")]
    static void Wire()
    {
        var server = Object.FindObjectOfType<LocalHttpServer>(true);
        if (server == null) { Debug.LogError("[Wire] LocalHttpServer not found."); return; }

        // Get values from VRMLoader if it exists (may be missing script in build)
        var loader = Object.FindObjectOfType<VRMLoader>(true);

        Undo.RecordObject(server, "Wire LocalHttpServer");

        if (loader != null)
        {
            if (server.mainModel == null)      server.mainModel      = loader.mainModel;
            if (server.animatorController == null) server.animatorController = loader.animatorController;

            // modelParent: use customModelOutput's transform
            if (server.modelParent == null && loader.customModelOutput != null)
                server.modelParent = loader.customModelOutput.transform;

            Debug.Log($"[Wire] Copied from VRMLoader: mainModel={server.mainModel?.name}, " +
                      $"modelParent={server.modelParent?.name}, " +
                      $"animatorController={server.animatorController?.name}");
        }
        else
        {
            Debug.LogWarning("[Wire] VRMLoader not found — please assign mainModel, modelParent, animatorController manually in LocalHttpServer Inspector.");
        }

        // Remove old vrmLoader field reference if it exists (no longer needed)
        EditorUtility.SetDirty(server);
        EditorSceneManager.SaveOpenScenes();

        string status = loader != null ? "Done! Fields copied from VRMLoader." : "VRMLoader missing — assign fields manually.";
        EditorUtility.DisplayDialog("Wire LocalHttpServer", status + "\nScene saved.", "OK");
    }
}
#endif
