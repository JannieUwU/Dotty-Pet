using UnityEngine;
using System.Collections;
using TMPro;
using Kirurobo;

public class BubbleHandler : MonoBehaviour
{
    [Header("UI")]
    public GameObject        bubbleRoot;
    public TextMeshProUGUI   bubbleText;
    public float             displayDuration = 5f;

    [Header("Offset (pixels)")]
    [Tooltip("Gap between model right edge and bubble left edge")]
    public float gapX    = 14f;
    [Tooltip("Upward offset from model chest position")]
    public float offsetY = 40f;

    // ── private ───────────────────────────────────────────────────────────────
    private Coroutine     _showCoroutine;
    private CanvasGroup   _canvasGroup;
    private RectTransform _bubbleRt;
    private Canvas        _canvas;
    private UnityEngine.UI.Image _bgImage;

    // White bubble background
    static readonly Color ColA = new Color(1.00f, 1.00f, 1.00f, 0.97f);
    static readonly Color ColB = new Color(0.96f, 0.96f, 0.98f, 0.97f);

    void Awake()
    {
        if (bubbleRoot == null) { Debug.LogError("[BubbleHandler] bubbleRoot not assigned!"); return; }
        _canvasGroup = bubbleRoot.GetComponent<CanvasGroup>() ?? bubbleRoot.AddComponent<CanvasGroup>();
        _bubbleRt    = bubbleRoot.GetComponent<RectTransform>();
        _canvas      = bubbleRoot.GetComponentInParent<Canvas>(true);
        _bgImage     = bubbleRoot.GetComponent<UnityEngine.UI.Image>();
        if (_bgImage != null) _bgImage.color = ColA;
        bubbleRoot.SetActive(false);
        Debug.Log("[BubbleHandler] Awake OK — canvas=" + (_canvas != null ? _canvas.name : "NULL"));
    }

    public void Show(string message)
    {
        Debug.Log("[BubbleHandler] Show called: " + message);
        if (bubbleRoot == null || bubbleText == null) { Debug.LogError("[BubbleHandler] refs null!"); return; }
        if (_showCoroutine != null) StopCoroutine(_showCoroutine);
        _showCoroutine = StartCoroutine(ShowSequence(message));
    }

    // ── Main sequence ─────────────────────────────────────────────────────────
    private IEnumerator ShowSequence(string message)
    {
        // Position before activating so there's no 1-frame flash at wrong pos
        PlaceOnScreen();
        bubbleRoot.SetActive(true);

        // Reset state
        _canvasGroup.alpha      = 0f;
        _bubbleRt.localScale    = new Vector3(0.4f, 0.4f, 1f);
        bubbleText.text         = "";
        bubbleText.maxVisibleCharacters = 0;

        // ── 1. Pop-in: scale + fade ───────────────────────────────────────────
        yield return StartCoroutine(PopIn());

        // ── 2. Typewriter ─────────────────────────────────────────────────────
        bubbleText.text = message;
        bubbleText.ForceMeshUpdate();
        int total = bubbleText.textInfo.characterCount;
        float charDelay = Mathf.Clamp(0.6f / Mathf.Max(total, 1), 0.018f, 0.045f);
        for (int i = 0; i <= total; i++)
        {
            bubbleText.maxVisibleCharacters = i;
            // Tiny pulse on bg every few chars
            if (i > 0 && i % 4 == 0 && _bgImage != null)
                StartCoroutine(BgPulse());
            yield return new WaitForSeconds(charDelay);
        }

        // ── 3. Hold ───────────────────────────────────────────────────────────
        yield return new WaitForSeconds(displayDuration);

        // ── 4. Float-up + fade out ────────────────────────────────────────────
        yield return StartCoroutine(FadeOut());

        bubbleRoot.SetActive(false);
        Debug.Log("[BubbleHandler] bubble hidden");
    }

    // ── Pop-in: elastic scale from origin side ────────────────────────────────
    private IEnumerator PopIn()
    {
        float t = 0f, dur = 0.32f;
        while (t < dur)
        {
            t += Time.deltaTime;
            float p = t / dur;
            // Elastic overshoot curve
            float s = ElasticOut(p);
            _bubbleRt.localScale = new Vector3(s, s, 1f);
            _canvasGroup.alpha   = Mathf.Clamp01(p * 3f);
            yield return null;
        }
        _bubbleRt.localScale = Vector3.one;
        _canvasGroup.alpha   = 1f;
    }

    // ── Float up + fade out ───────────────────────────────────────────────────
    private IEnumerator FadeOut()
    {
        float t = 0f, dur = 0.45f;
        Vector2 startPos = _bubbleRt.anchoredPosition;
        while (t < dur)
        {
            t += Time.deltaTime;
            float p = t / dur;
            _canvasGroup.alpha          = 1f - p;
            _bubbleRt.anchoredPosition  = startPos + new Vector2(0f, p * 18f);
            yield return null;
        }
        _canvasGroup.alpha         = 0f;
        _bubbleRt.anchoredPosition = startPos;
    }

    // ── Subtle bg colour pulse ────────────────────────────────────────────────
    private IEnumerator BgPulse()
    {
        if (_bgImage == null) yield break;
        float t = 0f, dur = 0.12f;
        while (t < dur)
        {
            t += Time.deltaTime;
            _bgImage.color = Color.Lerp(ColA, ColB, t / dur);
            yield return null;
        }
        _bgImage.color = ColA;
    }

    // ── Elastic easing ────────────────────────────────────────────────────────
    private static float ElasticOut(float t)
    {
        if (t <= 0f) return 0f;
        if (t >= 1f) return 1f;
        float p = 0.35f;
        return Mathf.Pow(2f, -10f * t) * Mathf.Sin((t - p / 4f) * (2f * Mathf.PI) / p) + 1f;
    }

    // ── Positioning ───────────────────────────────────────────────────────────
    private void PlaceOnScreen()
    {
        if (_bubbleRt == null || _canvas == null) return;
        var canvasRt = _canvas.GetComponent<RectTransform>();
        if (canvasRt == null) return;

        Vector2 modelScreen = GetModelScreenPos();
        float bubbleH = _bubbleRt.sizeDelta.y;

        float sx = modelScreen.x + gapX;
        float sy = modelScreen.y + offsetY;

        sx = Mathf.Clamp(sx, 4f, Screen.width  - _bubbleRt.sizeDelta.x - 4f);
        sy = Mathf.Clamp(sy, 4f, Screen.height - bubbleH - 4f);

        Debug.Log($"[BubbleHandler] modelScreen={modelScreen} sx={sx} sy={sy}");

        RectTransformUtility.ScreenPointToLocalPointInRectangle(
            canvasRt, new Vector2(sx, sy), null, out Vector2 local);
        _bubbleRt.anchoredPosition = local;
    }

    private Vector2 GetModelScreenPos()
    {
        Camera cam = Camera.main;
        if (cam == null) return new Vector2(Screen.width * 0.5f, Screen.height * 0.5f);

        var anim = FindFirstObjectByType<Animator>();
        if (anim != null && anim.isHuman)
        {
            Transform bone = anim.GetBoneTransform(HumanBodyBones.Chest)
                          ?? anim.GetBoneTransform(HumanBodyBones.Spine)
                          ?? anim.GetBoneTransform(HumanBodyBones.Hips);
            if (bone != null)
            {
                Vector3 sp = cam.WorldToScreenPoint(bone.position);
                if (sp.z > 0) return new Vector2(sp.x, sp.y);
            }
        }

        var smr = FindFirstObjectByType<SkinnedMeshRenderer>();
        if (smr != null)
        {
            Vector3 sp = cam.WorldToScreenPoint(smr.bounds.center);
            if (sp.z > 0) return new Vector2(sp.x, sp.y);
        }

        return new Vector2(Screen.width * 0.5f, Screen.height * 0.5f);
    }
}
