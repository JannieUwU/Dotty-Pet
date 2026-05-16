using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;
using System.IO;

/// <summary>
/// DottyPet → Build & Sync
/// Builds the Windows player and copies output to unity-build/ automatically.
/// Use this instead of File → Build Settings → Build.
/// </summary>
public static class BuildAndSync
{
    static readonly string[] CopyItems = {
        "DottyPet.exe",
        "UnityPlayer.dll",
        "UnityCrashHandler64.exe",
        "DottyPet_Data",
        "MonoBleedingEdge",
    };

    [MenuItem("DottyPet/Build & Sync to unity-build")]
    public static void Run()
    {
        // ── Resolve paths ─────────────────────────────────────────────────────
        string projectRoot = Path.GetFullPath(Path.Combine(Application.dataPath, ".."));
        string repoRoot    = Path.GetFullPath(Path.Combine(projectRoot, ".."));
        string buildDir    = Path.Combine(repoRoot, "_tmp_build");
        string targetDir   = Path.Combine(repoRoot, "unity-build");
        string buildExe    = Path.Combine(buildDir, "DottyPet.exe");

        Directory.CreateDirectory(buildDir);

        // ── Build ─────────────────────────────────────────────────────────────
        var options = new BuildPlayerOptions
        {
            scenes           = GetScenes(),
            locationPathName = buildExe,
            target           = BuildTarget.StandaloneWindows64,
            options          = BuildOptions.None,
        };

        Debug.Log($"[BuildAndSync] Building to {buildDir} ...");
        var report = BuildPipeline.BuildPlayer(options);

        if (report.summary.result != BuildResult.Succeeded)
        {
            EditorUtility.DisplayDialog("Build Failed",
                "Build did not succeed. Check the Console for errors.", "OK");
            return;
        }

        // ── Copy to unity-build/ ──────────────────────────────────────────────
        Debug.Log($"[BuildAndSync] Copying to {targetDir} ...");
        Directory.CreateDirectory(targetDir);

        foreach (var item in CopyItems)
        {
            string src = Path.Combine(buildDir, item);
            string dst = Path.Combine(targetDir, item);
            if (File.Exists(src))
                File.Copy(src, dst, overwrite: true);
            else if (Directory.Exists(src))
                CopyDir(src, dst);
        }

        // ── Clean up temp build dir ───────────────────────────────────────────
        try { Directory.Delete(buildDir, recursive: true); } catch { }

        Debug.Log("[BuildAndSync] Done — unity-build/ is up to date.");
        EditorUtility.DisplayDialog("Build & Sync Complete",
            "Build succeeded and unity-build/ has been updated.\n\nYou can now run npm run dev.", "OK");
    }

    static string[] GetScenes()
    {
        var scenes = new System.Collections.Generic.List<string>();
        foreach (var s in EditorBuildSettings.scenes)
            if (s.enabled) scenes.Add(s.path);
        return scenes.ToArray();
    }

    static void CopyDir(string src, string dst)
    {
        Directory.CreateDirectory(dst);
        foreach (var f in Directory.GetFiles(src, "*", SearchOption.TopDirectoryOnly))
            File.Copy(f, Path.Combine(dst, Path.GetFileName(f)), overwrite: true);
        foreach (var d in Directory.GetDirectories(src, "*", SearchOption.TopDirectoryOnly))
        {
            string name = Path.GetFileName(d);
            if (name.EndsWith("_DoNotShip")) continue;
            CopyDir(d, Path.Combine(dst, name));
        }
    }

    [MenuItem("DottyPet/Build & Sync to unity-build", validate = true)]
    public static bool Validate() => !Application.isPlaying && !EditorApplication.isCompiling;
}
