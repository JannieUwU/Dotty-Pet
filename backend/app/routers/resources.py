import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from app.database.connection import get_db
from app.database.models import ResourceFolder, ResourceFile
from app.config import RESOURCES_BASE_DIR
from app.dependencies import get_current_user_id

BASE_DIR = RESOURCES_BASE_DIR

def _user_dir(user_id: int) -> str:
    return os.path.join(BASE_DIR, str(user_id))

def _thumb_dir(user_id: int) -> str:
    return os.path.join(BASE_DIR, str(user_id), "thumbs")

os.makedirs(BASE_DIR, exist_ok=True)

router = APIRouter()

IMAGE_TYPES = {"png", "jpg", "jpeg", "gif", "bmp", "webp", "tiff"}
THUMB_SIZE  = (160, 160)
MAX_UPLOAD_BYTES = 200 * 1024 * 1024  # 200 MB
MAX_IMAGE_PIXELS = 50_000_000          # ~7000×7000 — guard against decompression bombs
CHUNK_SIZE = 64 * 1024                 # 64 KB streaming chunks
ALLOWED_EXTENSIONS = IMAGE_TYPES | {"pdf", "mp4", "mov", "avi", "mkv", "docx", "doc", "xlsx", "xls", "pptx", "ppt", "txt", "md", "zip", "rar", "7z", "csv", "json", "xml"}


def _resolve_path(stored_path: str) -> str:
    """Resolve a stored_path (relative or legacy absolute) to an absolute path."""
    if os.path.isabs(stored_path):
        return stored_path  # legacy absolute path — keep working
    return os.path.join(BASE_DIR, stored_path)


def _generate_thumb(file_id: int, stored_path: str, file_type: str, user_id: int) -> str | None:
    """Generate thumbnail, return path or None if not possible."""
    thumb_path = os.path.join(_thumb_dir(user_id), f"{file_id}.jpg")
    os.makedirs(os.path.dirname(thumb_path), exist_ok=True)
    if os.path.exists(thumb_path):
        return thumb_path
    try:
        if file_type == "pdf":
            import fitz
            doc = fitz.open(stored_path)
            page = doc[0]
            mat = fitz.Matrix(2, 2)
            pix = page.get_pixmap(matrix=mat)
            doc.close()
            if pix.width * pix.height > MAX_IMAGE_PIXELS:
                return None
            from PIL import Image
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            img.thumbnail(THUMB_SIZE)
            img.save(thumb_path, "JPEG", quality=85)
            return thumb_path
        elif file_type in IMAGE_TYPES:
            from PIL import Image
            Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
            img = Image.open(stored_path).convert("RGB")
            img.thumbnail(THUMB_SIZE)
            img.save(thumb_path, "JPEG", quality=85)
            return thumb_path
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Thumbnail generation failed for file %d: %s", file_id, e)
    return None


# ── schemas ───────────────────────────────────────────────────────────────────

class FolderIn(BaseModel):
    name: str
    color: str = "#83B5B5"

class FolderRename(BaseModel):
    name: str

class FileRename(BaseModel):
    name: str


# ── helpers ───────────────────────────────────────────────────────────────────

def safe_filename(name: str) -> str:
    """Strip path components and null bytes to prevent path traversal."""
    return os.path.basename(name).replace("\x00", "") or "unnamed"

def folder_out(f: ResourceFolder, count: int) -> dict:
    created = f.created_at if f.created_at and not f.created_at.startswith("(") else "2026-01-01 00:00:00"
    return {"id": f.id, "name": f.name, "color": f.color, "count": count, "created_at": created}

def file_out(f: ResourceFile) -> dict:
    size_mb = f.size_bytes / 1024 / 1024
    size_str = f"{size_mb:.1f} MB" if size_mb >= 0.1 else f"{f.size_bytes / 1024:.1f} KB"
    created = f.created_at if f.created_at and not f.created_at.startswith("(") else "2026-01-01 00:00:00"
    return {
        "id": f.id, "folder_id": f.folder_id, "name": f.name,
        "file_type": f.file_type, "size_bytes": f.size_bytes,
        "size": size_str, "created_at": created, "date": created[:10],
    }

def get_folder_counts(db: Session, folder_ids: list) -> dict:
    """Single query to get file counts for multiple folders."""
    if not folder_ids:
        return {}
    rows = (
        db.query(ResourceFile.folder_id, func.count(ResourceFile.id))
        .filter(ResourceFile.folder_id.in_(folder_ids))
        .group_by(ResourceFile.folder_id)
        .all()
    )
    return {fid: cnt for fid, cnt in rows}


# ── folders ───────────────────────────────────────────────────────────────────

@router.get("/folders")
def list_folders(db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    folders = db.query(ResourceFolder).filter(ResourceFolder.user_id == user_id).order_by(ResourceFolder.id).all()
    counts = get_folder_counts(db, [f.id for f in folders])
    return [folder_out(f, counts.get(f.id, 0)) for f in folders]


@router.post("/folders", status_code=201)
def create_folder(body: FolderIn, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Folder name cannot be empty")
    folder = ResourceFolder(user_id=user_id, name=name, color=body.color)
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return folder_out(folder, 0)


@router.patch("/folders/{folder_id}")
def rename_folder(folder_id: int, body: FolderRename, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    folder = db.query(ResourceFolder).filter(ResourceFolder.id == folder_id, ResourceFolder.user_id == user_id).first()
    if not folder:
        raise HTTPException(404, "Folder not found")
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Folder name cannot be empty")
    folder.name = name
    db.commit()
    db.refresh(folder)
    count = db.query(func.count(ResourceFile.id)).filter(ResourceFile.folder_id == folder_id).scalar() or 0
    return folder_out(folder, count)


@router.delete("/folders/{folder_id}", status_code=204)
def delete_folder(folder_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    folder = db.query(ResourceFolder).filter(ResourceFolder.id == folder_id, ResourceFolder.user_id == user_id).first()
    if not folder:
        raise HTTPException(404, "Folder not found")
    folder_dir = os.path.join(_user_dir(user_id), str(folder_id))
    db.delete(folder)
    db.commit()
    if os.path.exists(folder_dir):
        shutil.rmtree(folder_dir, ignore_errors=True)


# ── files ─────────────────────────────────────────────────────────────────────

@router.get("/folders/{folder_id}/files")
def list_files(folder_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    folder = db.query(ResourceFolder).filter(ResourceFolder.id == folder_id, ResourceFolder.user_id == user_id).first()
    if not folder:
        raise HTTPException(404, "Folder not found")
    files = db.query(ResourceFile).filter(ResourceFile.folder_id == folder_id).order_by(ResourceFile.id.desc()).all()
    return [file_out(f) for f in files]


@router.post("/folders/{folder_id}/files", status_code=201)
async def upload_file(folder_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    folder = db.query(ResourceFolder).filter(ResourceFolder.id == folder_id, ResourceFolder.user_id == user_id).first()
    if not folder:
        raise HTTPException(404, "Folder not found")

    original_name = safe_filename(file.filename or "unnamed")
    base, ext = os.path.splitext(original_name)
    file_type = ext.lstrip(".").lower() or "file"

    if file_type not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"File type '{file_type}' is not allowed")

    folder_dir = os.path.join(_user_dir(user_id), str(folder_id))
    os.makedirs(folder_dir, exist_ok=True)

    dest = os.path.join(folder_dir, original_name)
    counter = 1
    while os.path.exists(dest):
        dest = os.path.join(folder_dir, f"{base}_{counter}{ext}")
        counter += 1

    size_bytes = 0
    try:
        with open(dest, "wb") as fh:
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                size_bytes += len(chunk)
                if size_bytes > MAX_UPLOAD_BYTES:
                    fh.close()
                    os.remove(dest)
                    raise HTTPException(413, f"File exceeds maximum allowed size of {MAX_UPLOAD_BYTES // 1024 // 1024} MB")
                fh.write(chunk)
    except HTTPException:
        raise
    except OSError as e:
        if os.path.exists(dest):
            os.remove(dest)
        raise HTTPException(500, f"Failed to save file: {e}")

    # Store path relative to BASE_DIR so the DB is portable across moves
    rel_path = os.path.relpath(dest, BASE_DIR)
    try:
        rec = ResourceFile(
            folder_id=folder_id,
            name=original_name,
            file_type=file_type,
            size_bytes=size_bytes,
            stored_path=rel_path,
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)
    except Exception:
        if os.path.exists(dest):
            os.remove(dest)
        raise HTTPException(500, "Database error while saving file record")

    return file_out(rec)


@router.patch("/files/{file_id}")
def rename_file(file_id: int, body: FileRename, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    rec = db.query(ResourceFile).filter(ResourceFile.id == file_id).first()
    if not rec:
        raise HTTPException(404, "File not found")
    folder = db.query(ResourceFolder).filter(ResourceFolder.id == rec.folder_id, ResourceFolder.user_id == user_id).first()
    if not folder:
        raise HTTPException(403, "Access denied")
    name = body.name.strip()
    if name:
        rec.name = name
    db.commit()
    db.refresh(rec)
    return file_out(rec)


@router.delete("/files/{file_id}", status_code=204)
def delete_file(file_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    rec = db.query(ResourceFile).filter(ResourceFile.id == file_id).first()
    if not rec:
        raise HTTPException(404, "File not found")
    folder = db.query(ResourceFolder).filter(ResourceFolder.id == rec.folder_id, ResourceFolder.user_id == user_id).first()
    if not folder:
        raise HTTPException(403, "Access denied")
    stored = _resolve_path(rec.stored_path)
    db.delete(rec)
    db.commit()
    if os.path.exists(stored):
        os.remove(stored)


@router.post("/files/{file_id}/open", status_code=204)
def open_file(file_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    rec = db.query(ResourceFile).filter(ResourceFile.id == file_id).first()
    if not rec:
        raise HTTPException(404, "File not found")
    folder = db.query(ResourceFolder).filter(ResourceFolder.id == rec.folder_id, ResourceFolder.user_id == user_id).first()
    if not folder:
        raise HTTPException(403, "Access denied")
    real_path = os.path.realpath(_resolve_path(rec.stored_path))
    user_root = os.path.realpath(_user_dir(user_id)) + os.sep
    if not real_path.startswith(user_root):
        raise HTTPException(403, "Access denied")
    if not os.path.exists(real_path):
        raise HTTPException(404, "File missing from disk")
    import subprocess, sys
    if sys.platform == "win32":
        os.startfile(real_path)
    elif sys.platform == "darwin":
        subprocess.Popen(["open", real_path])
    else:
        subprocess.Popen(["xdg-open", real_path])


@router.get("/files/{file_id}/thumb")
def get_thumb(file_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    rec = db.query(ResourceFile).filter(ResourceFile.id == file_id).first()
    if not rec:
        raise HTTPException(404, "File not found")
    folder = db.query(ResourceFolder).filter(ResourceFolder.id == rec.folder_id, ResourceFolder.user_id == user_id).first()
    if not folder:
        raise HTTPException(403, "Access denied")
    real_path = os.path.realpath(_resolve_path(rec.stored_path))
    user_root = os.path.realpath(_user_dir(user_id)) + os.sep
    if not real_path.startswith(user_root):
        raise HTTPException(403, "Access denied")
    if not os.path.exists(real_path):
        raise HTTPException(404, "File missing from disk")
    thumb = _generate_thumb(rec.id, real_path, rec.file_type, user_id)
    if not thumb:
        raise HTTPException(404, "No thumbnail available")
    return FileResponse(thumb, media_type="image/jpeg",
                        headers={"Cache-Control": "max-age=86400"})


@router.get("/files/{file_id}/download")
def download_file(file_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    rec = db.query(ResourceFile).filter(ResourceFile.id == file_id).first()
    if not rec:
        raise HTTPException(404, "File not found")
    folder = db.query(ResourceFolder).filter(ResourceFolder.id == rec.folder_id, ResourceFolder.user_id == user_id).first()
    if not folder:
        raise HTTPException(403, "Access denied")
    real_path = os.path.realpath(_resolve_path(rec.stored_path))
    user_root = os.path.realpath(_user_dir(user_id)) + os.sep
    if not real_path.startswith(user_root):
        raise HTTPException(403, "Access denied")
    if not os.path.exists(real_path):
        raise HTTPException(404, "File missing from disk")
    return FileResponse(real_path, filename=rec.name)


@router.delete("/clear", status_code=200)
def clear_resources(db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    """Delete all resource folders, files, and disk data for the current user."""
    import logging
    log = logging.getLogger(__name__)

    folders = db.query(ResourceFolder).filter(
        ResourceFolder.user_id == user_id
    ).all()
    folder_ids = [f.id for f in folders]

    stored_paths: list[str] = []
    if folder_ids:
        files = db.query(ResourceFile).filter(
            ResourceFile.folder_id.in_(folder_ids)
        ).all()
        stored_paths = [f.stored_path for f in files]

    for folder in folders:
        db.delete(folder)
    db.commit()

    user_dir = _user_dir(user_id)
    if os.path.exists(user_dir):
        shutil.rmtree(user_dir, ignore_errors=True)

    log.info("Cleared resource library for user %d: %d folders, %d files", user_id, len(folder_ids), len(stored_paths))
    return {
        "ok": True,
        "deleted_folders": len(folder_ids),
        "deleted_files": len(stored_paths),
    }
