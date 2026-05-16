using System.Collections.Generic;

/// <summary>
/// Minimal JSON parser for LocalHttpServer — no external dependencies.
/// Only handles flat string/bool/number objects (sufficient for our API).
/// </summary>
public class SimpleJson
{
    private readonly Dictionary<string, string> _data = new();

    public static SimpleJson Parse(string json)
    {
        var result = new SimpleJson();
        if (string.IsNullOrWhiteSpace(json)) return result;
        json = json.Trim().TrimStart('{').TrimEnd('}');
        foreach (var pair in json.Split(','))
        {
            var kv = pair.Split(new[] { ':' }, 2);
            if (kv.Length != 2) continue;
            string key = kv[0].Trim().Trim('"');
            string val = kv[1].Trim().Trim('"');
            result._data[key] = val;
        }
        return result;
    }

    public string GetString(string key, string fallback = "") =>
        _data.TryGetValue(key, out var v) ? v : fallback;
}
