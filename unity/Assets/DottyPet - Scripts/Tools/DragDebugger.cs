using UnityEngine;
using System.Collections.Generic;

/// <summary>
/// Attach to any GameObject in the scene.
/// When dragging starts, logs every active Renderer in the scene with its
/// GameObject name, type, material, layer, and world position.
/// Remove this script after the bug is identified.
/// </summary>
public class DragDebugger : MonoBehaviour
{
    private bool wasDragging = false;

    void Update()
    {
        bool dragging = Input.GetMouseButton(0);

        if (dragging && !wasDragging)
        {
            LogAllRenderers("DRAG START");
        }
        if (!dragging && wasDragging)
        {
            LogAllRenderers("DRAG END");
        }

        wasDragging = dragging;
    }

    void LogAllRenderers(string label)
    {
        var renderers = FindObjectsByType<Renderer>(FindObjectsInactive.Exclude, FindObjectsSortMode.None);
        Debug.Log($"[DragDebugger] === {label} — {renderers.Length} active renderers ===");
        foreach (var r in renderers)
        {
            string matNames = "";
            if (r.sharedMaterials != null)
            {
                var names = new List<string>();
                foreach (var m in r.sharedMaterials)
                    names.Add(m != null ? m.name : "NULL");
                matNames = string.Join(", ", names);
            }
            Debug.Log($"[DragDebugger] {r.GetType().Name} | GO='{r.gameObject.name}' | Layer={r.gameObject.layer} | Pos={r.transform.position} | Mats=[{matNames}] | Enabled={r.enabled}");
        }
    }
}
