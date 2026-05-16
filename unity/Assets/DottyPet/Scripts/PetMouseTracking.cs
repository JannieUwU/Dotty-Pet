using System;
using System.Collections.Generic;
using UnityEngine;
using UniVRM10;

/// <summary>
/// Head / spine / eye tracking following the mouse cursor.
/// Requires a humanoid Animator on the same GameObject.
/// </summary>
[RequireComponent(typeof(Animator))]
public class PetMouseTracking : MonoBehaviour
{
    [Header("Enable")]
    public bool enableTracking = true;

    [Header("Head")]
    [Range(0f,90f)]  public float headYawLimit   = 45f;
    [Range(0f,90f)]  public float headPitchLimit  = 30f;
    [Range(1f,20f)]  public float headSmoothness  = 10f;
    [Range(0f,1f)]   public float headBlend       = 1f;

    [Header("Spine")]
    [Range(-90f,90f)] public float spineMin       = -15f;
    [Range(-90f,90f)] public float spineMax       =  15f;
    [Range(1f,50f)]   public float spineSmoothness = 25f;
    [Range(0f,1f)]    public float spineBlend      = 1f;

    [Header("Eye")]
    [Range(0f,90f)]  public float eyeYawLimit     = 12f;
    [Range(0f,90f)]  public float eyePitchLimit   = 12f;
    [Range(1f,20f)]  public float eyeSmoothness   = 10f;
    [Range(0f,1f)]   public float eyeBlend        = 1f;

    Animator   _anim;
    Camera     _cam;
    Vrm10Instance _vrm;

    Transform _headBone, _spineBone, _chestBone, _upperChestBone;
    Transform _leftEye, _rightEye;
    Transform _headDriver, _spineDriver, _leftEyeDriver, _rightEyeDriver, _eyeCenter, _vrmTarget;

    Quaternion _headInitRot, _spineInitRot;
    float _spineWeight;

    void Start()
    {
        _anim = GetComponent<Animator>();
        _cam  = Camera.main;
        if (_anim == null || !_anim.isHuman) { enableTracking = false; return; }
        _vrm = GetComponentInChildren<Vrm10Instance>();
        InitHead(); InitSpine(); InitEye();
    }

    void InitHead()
    {
        _headBone = _anim.GetBoneTransform(HumanBodyBones.Head);
        if (!_headBone) return;
        _headDriver = new GameObject("_HeadDriver").transform;
        _headDriver.SetParent(_headBone.parent, false);
        _headDriver.localPosition = _headBone.localPosition;
        _headDriver.localRotation = _headBone.localRotation;
        _headInitRot = _headBone.localRotation;
    }

    void InitSpine()
    {
        _spineBone      = _anim.GetBoneTransform(HumanBodyBones.Spine);
        _chestBone      = _anim.GetBoneTransform(HumanBodyBones.Chest);
        _upperChestBone = _anim.GetBoneTransform(HumanBodyBones.UpperChest);
        if (!_spineBone) return;
        _spineDriver = new GameObject("_SpineDriver").transform;
        _spineDriver.SetParent(_spineBone.parent, false);
        _spineDriver.localPosition = _spineBone.localPosition;
        _spineDriver.localRotation = _spineBone.localRotation;
        _spineInitRot = _spineBone.localRotation;
    }

    void InitEye()
    {
        _leftEye  = _anim.GetBoneTransform(HumanBodyBones.LeftEye);
        _rightEye = _anim.GetBoneTransform(HumanBodyBones.RightEye);

        if (_vrm != null)
        {
            _vrmTarget = new GameObject("_VRMLookAt").transform;
            _vrmTarget.SetParent(transform, false);
            _vrm.LookAtTarget     = _vrmTarget;
            _vrm.LookAtTargetType = VRM10ObjectLookAt.LookAtTargetTypes.YawPitchValue;
        }

        // fallback name search
        if (!_leftEye || !_rightEye)
        {
            foreach (var t in _anim.GetComponentsInChildren<Transform>())
            {
                string n = t.name.ToLower();
                if (!_leftEye  && (n.Contains("lefteye")  || n.Contains("eye.l"))) _leftEye  = t;
                if (!_rightEye && (n.Contains("righteye") || n.Contains("eye.r"))) _rightEye = t;
            }
        }

        if (_leftEye && _rightEye)
        {
            _eyeCenter = new GameObject("_EyeCenter").transform;
            _eyeCenter.SetParent(_leftEye.parent, false);
            _eyeCenter.position = (_leftEye.position + _rightEye.position) * 0.5f;

            _leftEyeDriver  = MakeDriver("_LEyeDriver",  _leftEye);
            _rightEyeDriver = MakeDriver("_REyeDriver", _rightEye);
        }
    }

    Transform MakeDriver(string name, Transform bone)
    {
        var t = new GameObject(name).transform;
        t.SetParent(bone.parent, false);
        t.localPosition = bone.localPosition;
        t.localRotation = bone.localRotation;
        return t;
    }

    void LateUpdate()
    {
        if (!enableTracking || !_cam || !_anim) return;
        DoHead();
        DoSpine();
        DoEye();
    }

    void DoHead()
    {
        if (!_headBone || !_headDriver) return;
        Vector3 world = MouseWorld();
        Vector3 local = _headDriver.parent.InverseTransformDirection((world - _headDriver.position).normalized);
        float yaw   = Mathf.Clamp(Mathf.Atan2(local.x, local.z) * Mathf.Rad2Deg, -headYawLimit,  headYawLimit);
        float pitch = Mathf.Clamp(Mathf.Asin(local.y)            * Mathf.Rad2Deg, -headPitchLimit, headPitchLimit);
        _headDriver.localRotation = Quaternion.Slerp(_headDriver.localRotation,
            Quaternion.Euler(-pitch, yaw, 0f), Time.deltaTime * headSmoothness);
        var delta = _headDriver.localRotation * Quaternion.Inverse(_headInitRot);
        _headBone.localRotation = Quaternion.Slerp(_headBone.localRotation, delta * _headBone.localRotation, headBlend);
    }

    void DoSpine()
    {
        if (!_spineBone || !_spineDriver) return;
        _spineWeight = Mathf.MoveTowards(_spineWeight, 1f, Time.deltaTime * 5f);
        float normX  = Mathf.Clamp01(Input.mousePosition.x / Screen.width);
        float targetY = Mathf.Lerp(spineMin, spineMax, normX);
        _spineDriver.localRotation = Quaternion.Slerp(_spineDriver.localRotation,
            Quaternion.Euler(0f, -targetY, 0f), Time.deltaTime * spineSmoothness);
        var delta   = _spineDriver.localRotation * Quaternion.Inverse(_spineInitRot);
        float blend = _spineWeight * spineBlend;
        _spineBone.localRotation = Quaternion.Slerp(Quaternion.identity, delta, blend) * _spineBone.localRotation;
        if (_chestBone)      _chestBone.localRotation      = Quaternion.Slerp(Quaternion.identity, delta, 0.8f * blend) * _chestBone.localRotation;
        if (_upperChestBone) _upperChestBone.localRotation = Quaternion.Slerp(Quaternion.identity, delta, 0.6f * blend) * _upperChestBone.localRotation;
    }

    void DoEye()
    {
        Vector3 world = MouseWorld();

        if (_vrm != null && _vrmTarget != null)
        {
            _vrmTarget.position = world;
            var par = _vrmTarget.parent ?? transform;
            Matrix4x4 mtx = Matrix4x4.TRS(par.position, par.rotation, Vector3.one);
            var (rawYaw, rawPitch) = mtx.CalcYawPitch(world);
            float yaw   = Mathf.Clamp(-rawYaw,  -eyeYawLimit,   eyeYawLimit);
            float pitch = Mathf.Clamp(rawPitch, -eyePitchLimit, eyePitchLimit);
            var tgt = Quaternion.Euler(-pitch, yaw, 0f) * Vector3.forward;
            _vrmTarget.rotation = Quaternion.LookRotation(
                Vector3.Slerp(_vrmTarget.forward, tgt, Time.deltaTime * eyeSmoothness));
            return;
        }

        if (!_leftEye || !_rightEye || !_eyeCenter) return;
        _eyeCenter.position = (_leftEye.position + _rightEye.position) * 0.5f;
        Vector3 local = _eyeCenter.parent.InverseTransformDirection((world - _eyeCenter.position).normalized);
        float eYaw   = Mathf.Clamp(Mathf.Atan2(local.x, local.z) * Mathf.Rad2Deg, -eyeYawLimit,   eyeYawLimit);
        float ePitch = Mathf.Clamp(Mathf.Asin(local.y)            * Mathf.Rad2Deg, -eyePitchLimit, eyePitchLimit);
        var rot = Quaternion.Euler(-ePitch, eYaw, 0f);
        _leftEyeDriver.localRotation  = Quaternion.Slerp(_leftEyeDriver.localRotation,  rot, Time.deltaTime * eyeSmoothness);
        _rightEyeDriver.localRotation = Quaternion.Slerp(_rightEyeDriver.localRotation, rot, Time.deltaTime * eyeSmoothness);
        _leftEye.localRotation  = Quaternion.Slerp(_leftEye.localRotation,  _leftEyeDriver.localRotation,  eyeBlend);
        _rightEye.localRotation = Quaternion.Slerp(_rightEye.localRotation, _rightEyeDriver.localRotation, eyeBlend);
    }

    Vector3 MouseWorld() =>
        _cam.ScreenToWorldPoint(new Vector3(Input.mousePosition.x, Input.mousePosition.y, _cam.nearClipPlane));

    void OnDestroy()
    {
        Destroy(_headDriver?.gameObject);
        Destroy(_spineDriver?.gameObject);
        Destroy(_leftEyeDriver?.gameObject);
        Destroy(_rightEyeDriver?.gameObject);
        Destroy(_eyeCenter?.gameObject);
        Destroy(_vrmTarget?.gameObject);
    }
}
