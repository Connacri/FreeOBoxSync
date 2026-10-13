/**
 * Predefined Object Schemas with CRDT field configurations
 */

import { EntitySchema } from '../types/sync';

export const INVENTORY_ITEM_SCHEMA: EntitySchema = {
  id: 101,
  name: 'WarehouseItem',
  properties: [
    { id: 1, name: 'sku', type: 'string', indexed: true },
    { id: 2, name: 'title', type: 'string' },
    { id: 3, name: 'stockQty', type: 'pn_counter' }, // PN-Counter for distributed stock
    { id: 4, name: 'unitPrice', type: 'float64' },     // LWW with HLC
    { id: 5, name: 'inStock', type: 'boolean' },
    { id: 6, name: 'tags', type: 'or_set' },           // OR-Set for categories/tags
    { id: 7, name: 'lastInspected', type: 'datetime' },
  ],
};

export const PATIENT_RECORD_SCHEMA: EntitySchema = {
  id: 102,
  name: 'PatientEmergencyRecord',
  properties: [
    { id: 1, name: 'patientId', type: 'string', indexed: true },
    { id: 2, name: 'fullName', type: 'string' },
    { id: 3, name: 'heartRateBpm', type: 'int32' },
    { id: 4, name: 'oxygenSaturation', type: 'float64' },
    { id: 5, name: 'allergies', type: 'or_set' },
    { id: 6, name: 'status', type: 'string' },
    { id: 7, name: 'dosageAdministered', type: 'pn_counter' },
  ],
};

export const FIELD_TASK_SCHEMA: EntitySchema = {
  id: 103,
  name: 'FieldServiceTask',
  properties: [
    { id: 1, name: 'taskCode', type: 'string', indexed: true },
    { id: 2, name: 'description', type: 'string' },
    { id: 3, name: 'assignedTechnician', type: 'string' },
    { id: 4, name: 'isCompleted', type: 'boolean' },
    { id: 5, name: 'laborHours', type: 'float64' },
    { id: 6, name: 'checkpoints', type: 'or_set' },
  ],
};

export const DEFAULT_SCHEMAS: EntitySchema[] = [
  INVENTORY_ITEM_SCHEMA,
  PATIENT_RECORD_SCHEMA,
  FIELD_TASK_SCHEMA,
];
