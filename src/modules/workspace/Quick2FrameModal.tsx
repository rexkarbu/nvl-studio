import React, { useState, useRef } from 'react';
import {
  CharacterLayer,
  ProjectAssetEntry,
  ProjectManifest,
  IdleConfig,
} from '../../core/project/types';
import { resolveAssetUrl } from '../../core/project/assetUrl';
import { applyReactive2FrameLayers, getReactiveFrameAssetIds } from '../../core/project/reactive2Frame';

export interface Quick2FrameModalProps {
  isOpen: boolean;
  onClose: () => void;
  manifest: ProjectManifest;
  serverPort?: number;
  onApply2FrameRig: (params: {
    layers: CharacterLayer[];
    assets: ProjectAssetEntry[];
    idleConfig: IdleConfig;
    reactive2Frame?: boolean;
  }) => void;
}

export const Quick2FrameModal: React.FC<Quick2FrameModalProps> = (props) => {
  if (!props.isOpen) return null;
  // Closing or switching projects starts a fresh draft from the latest manifest.
  return <Quick2FrameForm key={props.manifest.projectId} {...props} />;
};

const Quick2FrameForm: React.FC<Quick2FrameModalProps> = ({
  onClose,
  manifest,
  serverPort,
  onApply2FrameRig,
}) => {
  const [importedAssets, setImportedAssets] = useState<ProjectAssetEntry[]>([]);
  const allAssets = [...manifest.assets, ...importedAssets.filter((asset) =>
    !manifest.assets.some((existing) => existing.id === asset.id))];
  const [frame1AssetId, setFrame1AssetId] = useState(() => getReactiveFrameAssetIds(manifest)[0]);
  const [frame2AssetId, setFrame2AssetId] = useState(() => getReactiveFrameAssetIds(manifest)[1]);
  const [enableDimming, setEnableDimming] = useState<boolean>(
    manifest.idleConfig?.dimWhenSilent ?? true
  );
  const [idleBrightness, setIdleBrightness] = useState<number>(
    manifest.idleConfig?.idleBrightness ?? 0.75
  );
  const [enableBobbing, setEnableBobbing] = useState<boolean>(
    manifest.idleConfig?.enabled ?? true
  );
  const [replaceLayers, setReplaceLayers] = useState<boolean>(true);

  const fileInputRef1 = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);

  const hasValidFrames = [frame1AssetId, frame2AssetId].every((id) =>
    allAssets.some((asset) => asset.id === id));

  // Resolve image source URL for thumbnail previews
  const getAssetPreviewUrl = (assetId: string): string => {
    const asset = allAssets.find((a) => a.id === assetId);
    if (!asset) return '';
    return resolveAssetUrl(asset.path, {
      serverPort,
      version: manifest.metadata?.updatedAt,
    });
  };

  // Import handler for desktop or fallback browser file reader
  const handleImportPhoto = async (targetFrame: 1 | 2) => {
    if ((window as any).nvlDesktop?.importPng) {
      try {
        const res = await (window as any).nvlDesktop.importPng();
        if (res.assets && res.assets.length > 0) {
          const imported = res.assets[0];
          setImportedAssets((prev) => {
            const next = [...prev];
            if (!next.some((a) => a.id === imported.id)) {
              next.push(imported);
            }
            return next;
          });
          if (targetFrame === 1) {
            setFrame1AssetId(imported.id);
          } else {
            setFrame2AssetId(imported.id);
          }
        }
      } catch (err) {
        console.error('Desktop import error:', err);
      }
    } else {
      // Trigger hidden HTML file input
      if (targetFrame === 1) {
        fileInputRef1.current?.click();
      } else {
        fileInputRef2.current?.click();
      }
    }
  };

  const handleBrowserFileChange = (e: React.ChangeEvent<HTMLInputElement>, targetFrame: 1 | 2) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const newAsset: ProjectAssetEntry = {
        id: `asset-frame-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        path: dataUrl,
        format: 'png',
      };
      setImportedAssets((prev) => [...prev, newAsset]);
      if (targetFrame === 1) {
        setFrame1AssetId(newAsset.id);
      } else {
        setFrame2AssetId(newAsset.id);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApply = () => {
    if (!hasValidFrames) return;

    const centerCanvasX = Math.round(manifest.canvas.width / 2);
    const centerCanvasY = Math.round(manifest.canvas.height / 2);

    const idleLayer: CharacterLayer = {
      id: `layer-2frame-idle-${Date.now()}`,
      name: 'Idle (Silent)',
      type: 'sprite',
      assetId: frame1AssetId,
      role: 'mouth_closed',
      x: centerCanvasX,
      y: centerCanvasY,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
      visible: true,
      zIndex: 0,
    };

    const talkingLayer: CharacterLayer = {
      id: `layer-2frame-talk-${Date.now() + 1}`,
      name: 'Talking (Speaking)',
      type: 'sprite',
      assetId: frame2AssetId,
      role: 'mouth_open',
      x: centerCanvasX,
      y: centerCanvasY,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
      visible: true,
      zIndex: 1,
    };

    const updatedLayers = applyReactive2FrameLayers(manifest.layers, idleLayer, talkingLayer, replaceLayers);

    const updatedIdleConfig: IdleConfig = {
      enabled: enableBobbing,
      amplitude: manifest.idleConfig?.amplitude ?? 8,
      speed: manifest.idleConfig?.speed ?? 1.5,
      dimWhenSilent: enableDimming,
      idleBrightness: idleBrightness,
    };

    onApply2FrameRig({
      layers: updatedLayers,
      assets: allAssets,
      idleConfig: updatedIdleConfig,
      reactive2Frame: true,
    });

    onClose();
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(10, 10, 18, 0.78)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Hidden browser file inputs */}
      <input
        type="file"
        ref={fileInputRef1}
        style={{ display: 'none' }}
        accept="image/png,image/webp,image/jpeg"
        onChange={(e) => handleBrowserFileChange(e, 1)}
      />
      <input
        type="file"
        ref={fileInputRef2}
        style={{ display: 'none' }}
        accept="image/png,image/webp,image/jpeg"
        onChange={(e) => handleBrowserFileChange(e, 2)}
      />

      <div
        className="modal-container"
        role="dialog"
        aria-modal="true"
        aria-label="Quick 2-Frame Avatar Setup"
        style={{
          background: '#16161e',
          border: '1px solid #2e2c40',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '680px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #2e2c40',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#fffffe' }}>
              🎭 Quick 2-Frame Avatar Setup
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a1b2' }}>
              Import dan atur avatar 2-frame (diam & bicara) secara instan tanpa perlu potong mata/tubuh.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a1b2',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Two Frame Slots */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Frame 1: Idle (Silent) */}
            <div
              style={{
                background: '#1a1926',
                border: '1px solid #2e2c40',
                borderRadius: '8px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '13px', color: '#fffffe' }}>
                  Frame 1: Diam (Idle)
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'rgba(127, 90, 240, 0.2)',
                    color: '#7f5af0',
                  }}
                >
                  mouth_closed
                </span>
              </div>

              {/* Preview Box */}
              <div
                style={{
                  height: '140px',
                  borderRadius: '6px',
                  background: '#0d0d12',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative',
                  border: '1px dashed #2e2c40',
                }}
              >
                {frame1AssetId ? (
                  <img
                    src={getAssetPreviewUrl(frame1AssetId)}
                    alt="Frame 1 Preview"
                    style={{
                      maxHeight: '100%',
                      maxWidth: '100%',
                      objectFit: 'contain',
                      filter: enableDimming ? `brightness(${Math.round(idleBrightness * 100)}%)` : 'none',
                      transition: 'filter 0.2s ease',
                    }}
                  />
                ) : (
                  <span style={{ fontSize: '11px', color: '#72757e' }}>Belum ada foto terpilih</span>
                )}
                {enableDimming && frame1AssetId && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '4px',
                      right: '4px',
                      fontSize: '9px',
                      background: 'rgba(0,0,0,0.7)',
                      padding: '2px 4px',
                      borderRadius: '3px',
                      color: '#a7a9be',
                    }}
                  >
                    Dimmed: {Math.round(idleBrightness * 100)}%
                  </span>
                )}
              </div>

              <select
                aria-label="Frame diam"
                value={frame1AssetId}
                onChange={(e) => setFrame1AssetId(e.target.value)}
                style={{
                  background: '#16161e',
                  color: '#fffffe',
                  border: '1px solid #2e2c40',
                  borderRadius: '6px',
                  padding: '6px 8px',
                  fontSize: '12px',
                }}
              >
                <option value="" disabled>
                  Pilih Aset...
                </option>
                {allAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="action-btn btn-secondary"
                style={{ fontSize: '11px', padding: '6px' }}
                onClick={() => handleImportPhoto(1)}
              >
                📁 Import / Browse Foto Diam...
              </button>
            </div>

            {/* Frame 2: Talking (Speaking) */}
            <div
              style={{
                background: '#1a1926',
                border: '1px solid #2e2c40',
                borderRadius: '8px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '13px', color: '#fffffe' }}>
                  Frame 2: Bicara (Talking)
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'rgba(44, 182, 125, 0.2)',
                    color: '#2cb67d',
                  }}
                >
                  mouth_open
                </span>
              </div>

              {/* Preview Box */}
              <div
                style={{
                  height: '140px',
                  borderRadius: '6px',
                  background: '#0d0d12',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative',
                  border: '1px dashed #2e2c40',
                }}
              >
                {frame2AssetId ? (
                  <img
                    src={getAssetPreviewUrl(frame2AssetId)}
                    alt="Frame 2 Preview"
                    style={{
                      maxHeight: '100%',
                      maxWidth: '100%',
                      objectFit: 'contain',
                    }}
                  />
                ) : (
                  <span style={{ fontSize: '11px', color: '#72757e' }}>Belum ada foto terpilih</span>
                )}
                {frame2AssetId && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '4px',
                      right: '4px',
                      fontSize: '9px',
                      background: 'rgba(0,0,0,0.7)',
                      padding: '2px 4px',
                      borderRadius: '3px',
                      color: '#2cb67d',
                    }}
                  >
                    Active: 100%
                  </span>
                )}
              </div>

              <select
                aria-label="Frame bicara"
                value={frame2AssetId}
                onChange={(e) => setFrame2AssetId(e.target.value)}
                style={{
                  background: '#16161e',
                  color: '#fffffe',
                  border: '1px solid #2e2c40',
                  borderRadius: '6px',
                  padding: '6px 8px',
                  fontSize: '12px',
                }}
              >
                <option value="" disabled>
                  Pilih Aset...
                </option>
                {allAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="action-btn btn-secondary"
                style={{ fontSize: '11px', padding: '6px' }}
                onClick={() => handleImportPhoto(2)}
              >
                📁 Import / Browse Foto Bicara...
              </button>
            </div>
          </div>

          {/* Options & Reactive Behavior */}
          <div
            style={{
              background: '#1a1926',
              border: '1px solid #2e2c40',
              borderRadius: '8px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: '12px', color: '#fffffe' }}>
              ⚙️ Pengaturan Reaktif & Animasi
            </span>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#fffffe', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enableDimming}
                onChange={(e) => setEnableDimming(e.target.checked)}
              />
              <span>
                <strong>Idle Dimming:</strong> Gelap saat diam ({Math.round(idleBrightness * 100)}%), cerah 100% saat berbicara 🌙
              </span>
            </label>

            {enableDimming && (
              <div style={{ marginLeft: '24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a1b2' }}>
                  <span>Kecerahan saat diam</span>
                  <span>{Math.round(idleBrightness * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.40"
                  max="0.95"
                  step="0.05"
                  aria-label="Kecerahan saat diam"
                  value={idleBrightness}
                  onChange={(e) => setIdleBrightness(Number(e.target.value))}
                />
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#fffffe', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enableBobbing}
                onChange={(e) => setEnableBobbing(e.target.checked)}
              />
              <span>
                <strong>Idle Bobbing:</strong> Avatar memantul naik-turun halus saat hening 🤾
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#fffffe', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={replaceLayers}
                onChange={(e) => setReplaceLayers(e.target.checked)}
              />
              <span>Ganti semua layer aktif dengan konfigurasi 2-frame baru (Bersih)</span>
            </label>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #2e2c40',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <button
            type="button"
            className="action-btn btn-secondary"
            onClick={onClose}
          >
            Batal
          </button>
          <button
            type="button"
            className="action-btn btn-primary"
            onClick={handleApply}
            disabled={!hasValidFrames}
            style={{
              opacity: !hasValidFrames ? 0.5 : 1,
              cursor: !hasValidFrames ? 'not-allowed' : 'pointer',
            }}
          >
            ✨ Terapkan Avatar 2-Frame
          </button>
        </div>
      </div>
    </div>
  );
};
