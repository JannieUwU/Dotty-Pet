"""System resource monitoring."""
import os
import psutil


def get_resources() -> dict:
    mem = psutil.virtual_memory()
    drive = os.path.splitdrive(os.path.expanduser("~"))[0] or "/"
    disk = psutil.disk_usage(drive)
    return {
        "cpu_percent": psutil.cpu_percent(interval=0.1),
        "memory": {
            "total_gb": round(mem.total / 1e9, 1),
            "used_gb": round(mem.used / 1e9, 1),
            "percent": mem.percent,
        },
        "disk": {
            "total_gb": round(disk.total / 1e9, 1),
            "used_gb": round(disk.used / 1e9, 1),
            "percent": disk.percent,
        },
    }
