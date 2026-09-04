import React from 'react';
import { CharacterLayer, SemanticLayerRole } from '../../core/project/types';
import { ROLE_METADATA } from '../../core/project/roleAssignment';

interface RoleSelectorProps {
  currentRole: SemanticLayerRole;
  currentLayerId: string;
  allLayers: CharacterLayer[];
  onRoleSelect: (newRole: SemanticLayerRole) => void;
  disabled?: boolean;
}

const ALL_ROLES: SemanticLayerRole[] = [
  'body',
  'eye_open',
  'eye_closed',
  'mouth_closed',
  'mouth_open',
  'accessory',
  'custom',
];

export const RoleSelector: React.FC<RoleSelectorProps> = ({
  currentRole,
  currentLayerId,
  allLayers,
  onRoleSelect,
  disabled = false,
}) => {
  const currentDef = ROLE_METADATA[currentRole] || ROLE_METADATA.custom;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onRoleSelect(e.target.value as SemanticLayerRole);
  };

  return (
    <div className="role-selector-container">
      <div className="role-selector-select-wrapper">
        <select
          className="role-select-dropdown"
          value={currentRole}
          onChange={handleChange}
          disabled={disabled}
        >
          {ALL_ROLES.map((roleKey) => {
            const def = ROLE_METADATA[roleKey];
            // Check if another layer has this unique role
            const otherOwner = def.isUnique
              ? allLayers.find((l) => l.id !== currentLayerId && l.role === roleKey)
              : undefined;

            return (
              <option key={roleKey} value={roleKey}>
                {def.label} {otherOwner ? `(Currently on "${otherOwner.name}")` : ''}
              </option>
            );
          })}
        </select>
      </div>

      <p className="role-description-hint">{currentDef.description}</p>
    </div>
  );
};
