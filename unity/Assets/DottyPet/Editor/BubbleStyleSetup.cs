using UnityEngine;
using UnityEditor;
using TMPro;
using UnityEngine.UI;

/// <summary>
/// Rebuilds the BubbleRoot visual style to match the SVG reference:
/// white rounded rectangle body + bottom-left tail triangle.
/// Menu: DottyPet → Rebuild Bubble Style
/// </summary>
public static class BubbleStyleSetup
{
    [MenuItem("DottyPet/Rebuild Bubble Style")]
    public static void Run()
    {
        // ── Find existing BubbleRoot ──────────────────────────────────────────
        var handler = Object.FindObjectOfType<BubbleHandler>();
        if (handler == null || handler.bubbleRoot == null)
        {
            EditorUtility.DisplayDialog("DottyPet", "BubbleHandler or bubbleRoot not found.\nRun 'Setup Notification Bubble' first.", "OK");
            return;
        }

        var bubbleRootGO = handler.bubbleRoot;
        var bubbleRt     = bubbleRootGO.GetComponent<RectTransform>();

        // ── Resize bubble body ────────────────────────────────────────────────
        bubbleRt.sizeDelta = new Vector2(300, 90);
        // Pivot bottom-left so tail aligns naturally
        bubbleRt.pivot = new Vector2(0f, 0f);

        // ── Body background: white rounded rect ───────────────────────────────
        var bg = bubbleRootGO.GetComponent<Image>();
        if (bg == null) bg = bubbleRootGO.AddComponent<Image>();
        bg.sprite        = AssetDatabase.GetBuiltinExtraResource<Sprite>("UI/Skin/UISprite.psd");
        bg.type          = Image.Type.Sliced;
        bg.pixelsPerUnitMultiplier = 0.35f; // larger slice = rounder corners
        bg.color         = new Color(1f, 1f, 1f, 0.97f);
        bg.raycastTarget = false;

        // ── Shadow (soft dark image behind body) ─────────────────────────────
        var shadowGO = bubbleRootGO.transform.Find("Shadow")?.gameObject;
        if (shadowGO == null)
        {
            shadowGO = new GameObject("Shadow", typeof(RectTransform), typeof(Image));
            shadowGO.transform.SetParent(bubbleRootGO.transform, false);
            shadowGO.transform.SetAsFirstSibling();
            Undo.RegisterCreatedObjectUndo(shadowGO, "Create Shadow");
        }
        var shadowRt = shadowGO.GetComponent<RectTransform>();
        shadowRt.anchorMin        = Vector2.zero;
        shadowRt.anchorMax        = Vector2.one;
        shadowRt.offsetMin        = new Vector2(-3f, -5f);
        shadowRt.offsetMax        = new Vector2(3f,  3f);
        var shadowImg = shadowGO.GetComponent<Image>() ?? shadowGO.AddComponent<Image>();
        shadowImg.sprite       = AssetDatabase.GetBuiltinExtraResource<Sprite>("UI/Skin/UISprite.psd");
        shadowImg.type         = Image.Type.Sliced;
        shadowImg.pixelsPerUnitMultiplier = 0.35f;
        shadowImg.color        = new Color(0f, 0f, 0f, 0.07f); // very subtle shadow
        shadowImg.raycastTarget = false;

        // ── Tail triangle (bottom-left, pointing down-left) ───────────────────
        var tailGO = bubbleRootGO.transform.Find("Tail")?.gameObject;
        if (tailGO == null)
        {
            tailGO = new GameObject("Tail", typeof(RectTransform), typeof(Image));
            tailGO.transform.SetParent(bubbleRootGO.transform, false);
            tailGO.transform.SetSiblingIndex(1);
            Undo.RegisterCreatedObjectUndo(tailGO, "Create Tail");
        }
        var tailRt = tailGO.GetComponent<RectTransform>();
        tailRt.anchorMin        = new Vector2(0f, 0f);
        tailRt.anchorMax        = new Vector2(0f, 0f);
        tailRt.pivot            = new Vector2(0.5f, 1f);
        tailRt.sizeDelta        = new Vector2(22f, 18f);
        tailRt.anchoredPosition = new Vector2(28f, 0f); // sits at bottom-left of body
        tailRt.localRotation    = Quaternion.identity;

        var tailImg = tailGO.GetComponent<Image>() ?? tailGO.AddComponent<Image>();
        // Use a simple white triangle via the knob sprite (solid circle cropped) —
        // Unity doesn't have a built-in triangle, so we rotate a square 45° and mask.
        // Simplest approach: use the default white sprite and rotate 45°.
        tailImg.sprite       = AssetDatabase.GetBuiltinExtraResource<Sprite>("UI/Skin/Knob.psd");
        tailImg.color        = new Color(1f, 1f, 1f, 0.96f);
        tailImg.raycastTarget = false;
        tailRt.localRotation = Quaternion.Euler(0f, 0f, 45f);
        tailRt.sizeDelta     = new Vector2(16f, 16f);
        tailRt.anchoredPosition = new Vector2(20f, -6f);

        // ── Text padding update ───────────────────────────────────────────────
        var textGO = bubbleRootGO.transform.Find("BubbleText")?.gameObject;
        if (textGO != null)
        {
            var textRt = textGO.GetComponent<RectTransform>();
            textRt.anchorMin = Vector2.zero;
            textRt.anchorMax = Vector2.one;
            textRt.offsetMin = new Vector2(14f, 10f);
            textRt.offsetMax = new Vector2(-14f, -10f);

            var tmp = textGO.GetComponent<TextMeshProUGUI>();
            if (tmp != null)
            {
                tmp.fontSize  = 17;
                tmp.color     = new Color(0.15f, 0.15f, 0.15f, 1f);
                tmp.alignment = TextAlignmentOptions.MidlineLeft;
                tmp.textWrappingMode = TMPro.TextWrappingModes.Normal;
            }
        }

        // ── Mark dirty ────────────────────────────────────────────────────────
        EditorUtility.SetDirty(bubbleRootGO);
        UnityEditor.SceneManagement.EditorSceneManager.MarkSceneDirty(
            bubbleRootGO.scene);

        Debug.Log("[DottyPet] Bubble style rebuilt. Save scene (Ctrl+S) then rebuild.");
        EditorUtility.DisplayDialog("DottyPet",
            "Bubble style updated!\n\n1. Save scene (Ctrl+S)\n2. File → Build Settings → Build", "OK");
    }

    [MenuItem("DottyPet/Rebuild Bubble Style", validate = true)]
    public static bool Validate() => !Application.isPlaying;
}
