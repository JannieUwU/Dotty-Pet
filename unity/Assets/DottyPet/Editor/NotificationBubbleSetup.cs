using UnityEngine;
using UnityEditor;
using TMPro;
using UnityEngine.UI;

/// <summary>
/// One-click setup: creates the notification speech bubble UI in the scene
/// and wires BubbleHandler + PetController references automatically.
///
/// Menu: DottyPet → Setup Notification Bubble
/// </summary>
public static class NotificationBubbleSetup
{
    [MenuItem("DottyPet/Setup Notification Bubble")]
    public static void Run()
    {
        // ── 1. Find PetController in scene ───────────────────────────────────
        var petController = Object.FindObjectOfType<PetController>();
        if (petController == null)
        {
            EditorUtility.DisplayDialog("DottyPet Setup",
                "PetController not found in the scene.\n\nMake sure the DottyPet Main scene is open and the pet GameObject is active.",
                "OK");
            return;
        }

        // ── 2. Skip if already set up ─────────────────────────────────────────
        var existingBubble = petController.GetComponent<BubbleHandler>()
                          ?? petController.GetComponentInChildren<BubbleHandler>(true);
        if (existingBubble != null && petController.bubbleHandler != null)
        {
            EditorUtility.DisplayDialog("DottyPet Setup",
                "Notification bubble is already set up on this PetController.", "OK");
            return;
        }

        // ── 3. Find or create a World Space Canvas on the pet ─────────────────
        // World Space canvas so the bubble follows the character in screen space.
        Canvas canvas = petController.GetComponentInChildren<Canvas>(true);
        if (canvas == null)
        {
            var canvasGO = new GameObject("NotificationCanvas");
            canvasGO.transform.SetParent(petController.transform, false);
            canvas = canvasGO.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.WorldSpace;
            canvasGO.AddComponent<CanvasScaler>();
            canvasGO.AddComponent<GraphicRaycaster>();

            // Size and position above the character's head
            var rt = canvasGO.GetComponent<RectTransform>();
            rt.sizeDelta        = new Vector2(300, 120);
            rt.localPosition    = new Vector3(0, 2.2f, 0);
            rt.localScale       = new Vector3(0.005f, 0.005f, 0.005f);

            Undo.RegisterCreatedObjectUndo(canvasGO, "Create NotificationCanvas");
        }

        // ── 4. Create BubbleRoot inside the canvas ────────────────────────────
        var bubbleRootGO = new GameObject("BubbleRoot");
        bubbleRootGO.transform.SetParent(canvas.transform, false);

        var bubbleRt = bubbleRootGO.AddComponent<RectTransform>();
        bubbleRt.anchorMin  = new Vector2(0.5f, 0.5f);
        bubbleRt.anchorMax  = new Vector2(0.5f, 0.5f);
        bubbleRt.pivot      = new Vector2(0.5f, 0f);
        bubbleRt.sizeDelta  = new Vector2(280, 100);
        bubbleRt.anchoredPosition = Vector2.zero;

        // Background image (white rounded panel)
        var bg = bubbleRootGO.AddComponent<Image>();
        bg.color = new Color(1f, 1f, 1f, 0.95f);
        bg.raycastTarget = false;

        // CanvasGroup for fade
        bubbleRootGO.AddComponent<CanvasGroup>();

        Undo.RegisterCreatedObjectUndo(bubbleRootGO, "Create BubbleRoot");

        // ── 5. Create BubbleText inside BubbleRoot ────────────────────────────
        var textGO = new GameObject("BubbleText");
        textGO.transform.SetParent(bubbleRootGO.transform, false);

        var textRt = textGO.AddComponent<RectTransform>();
        textRt.anchorMin        = Vector2.zero;
        textRt.anchorMax        = Vector2.one;
        textRt.offsetMin        = new Vector2(10, 8);
        textRt.offsetMax        = new Vector2(-10, -8);

        var tmp = textGO.AddComponent<TextMeshProUGUI>();
        tmp.text              = "Hello!";
        tmp.fontSize          = 18;
        tmp.color             = new Color(0.2f, 0.2f, 0.2f, 1f);
        tmp.alignment         = TextAlignmentOptions.Center;
        tmp.enableWordWrapping = true;
        tmp.raycastTarget     = false;

        Undo.RegisterCreatedObjectUndo(textGO, "Create BubbleText");

        // ── 6. Add BubbleHandler to PetController's GameObject ────────────────
        var handler = petController.gameObject.GetComponent<BubbleHandler>();
        if (handler == null)
            handler = Undo.AddComponent<BubbleHandler>(petController.gameObject);

        handler.bubbleRoot      = bubbleRootGO;
        handler.bubbleText      = tmp;
        handler.displayDuration = 5f;

        // ── 7. Wire BubbleHandler into PetController ──────────────────────────
        Undo.RecordObject(petController, "Wire BubbleHandler");
        petController.bubbleHandler = handler;

        // ── 8. Mark scene dirty so Unity prompts to save ──────────────────────
        EditorUtility.SetDirty(petController);
        EditorUtility.SetDirty(handler);
        UnityEditor.SceneManagement.EditorSceneManager.MarkSceneDirty(
            petController.gameObject.scene);

        Debug.Log("[DottyPet] Notification bubble setup complete. Save the scene (Ctrl+S).");
        EditorUtility.DisplayDialog("DottyPet Setup",
            "Notification bubble created and wired successfully!\n\nRemember to:\n1. Save the scene (Ctrl+S)\n2. Rebuild the Unity project",
            "OK");
    }

    [MenuItem("DottyPet/Setup Notification Bubble", validate = true)]
    public static bool RunValidate() => !Application.isPlaying;
}
