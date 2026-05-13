#!/usr/bin/env python3
"""Quick setup: create venv and install dependencies."""
import subprocess, sys, os

venv = os.path.join(os.path.dirname(__file__), ".venv")
subprocess.run([sys.executable, "-m", "venv", venv], check=True)
pip = os.path.join(venv, "Scripts", "pip.exe") if os.name == "nt" else os.path.join(venv, "bin", "pip")
subprocess.run([pip, "install", "-r", "requirements.txt"], check=True)
print("\n✓ Setup complete. Run: .venv\\Scripts\\python main.py")
