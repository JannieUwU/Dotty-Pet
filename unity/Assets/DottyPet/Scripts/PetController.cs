using UnityEngine;

/// <summary>
/// Central state machine for the desktop pet character.
/// Receives commands from LocalHttpServer and drives the Animator.
/// Emotion states: idle, happy, focused, tired, stressed, bored
///
/// The Animator reference is NOT obtained via RequireComponent — it is
/// injected by PetVRMLoader.RewireControllers() after every model swap
/// so that commands always target the currently active model.
/// </summary>
public class PetController : MonoBehaviour
{
    public static PetController Instance { get; private set; }

    [Header("References")]
    public BubbleHandler bubbleHandler;

    /// <summary>
    /// Assign in Inspector for the default model. PetVRMLoader will
    /// call SetAnimator() to redirect this after every VRM swap.
    /// </summary>
    [Header("Animator (re-wired on model swap)")]
    public Animator defaultAnimator;

    private Animator _animator;
    private volatile string _currentState = "idle";

    private static readonly int EmotionHash      = Animator.StringToHash("Emotion");
    private static readonly int TriggerActionHash = Animator.StringToHash("TriggerAction");
    private static readonly int ActionIndexHash   = Animator.StringToHash("ActionIndex");

    private static readonly System.Collections.Generic.Dictionary<string, int> EmotionIndex = new()
    {
        { "idle",     0 },
        { "happy",    1 },
        { "focused",  2 },
        { "tired",    3 },
        { "stressed", 4 },
        { "bored",    5 },
    };

    private static readonly System.Collections.Generic.Dictionary<string, int> ActionIndex = new()
    {
        { "dance",  0 },
        { "wave",   1 },
        { "jump",   2 },
        { "sleep",  3 },
    };

    public string CurrentState => _currentState;

    void Awake()
    {
        if (Instance != null && Instance != this) { Destroy(gameObject); return; }
        Instance = this;
        // Start with the default model's animator; PetVRMLoader will redirect later
        _animator = defaultAnimator;
    }

    /// <summary>
    /// Called by PetVRMLoader after every model swap to redirect animation
    /// commands to the newly loaded model's Animator.
    /// </summary>
    public void SetAnimator(Animator anim)
    {
        _animator = anim;
        // Re-apply current emotion so the new model starts in the right state
        if (_animator != null && EmotionIndex.TryGetValue(_currentState, out int idx))
            _animator.SetInteger(EmotionHash, idx);
    }

    public void SetEmotion(string state)
    {
        if (_animator == null) return;
        if (!EmotionIndex.TryGetValue(state, out int idx)) idx = 0;
        _currentState = state;
        _animator.SetInteger(EmotionHash, idx);
        Debug.Log($"[PetController] Emotion → {state}");
    }

    public void TriggerAnimation(string action)
    {
        if (_animator == null) return;
        if (!ActionIndex.TryGetValue(action, out int idx)) return;
        _animator.SetInteger(ActionIndexHash, idx);
        _animator.SetTrigger(TriggerActionHash);
        Debug.Log($"[PetController] Action → {action}");
    }

    public void ShowNotification(string message)
    {
        bubbleHandler?.Show(message);
        Debug.Log($"[PetController] Notification → {message}");
    }
}
