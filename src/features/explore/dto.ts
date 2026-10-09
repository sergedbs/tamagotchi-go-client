import { z } from 'zod'

export const locationSchema = z.object({
  user_id: z.string(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  timestamp: z.string(),
  accuracy_m: z.number().nullable(),
  expires_at: z.string(),
})
export type OwnLocation = z.output<typeof locationSchema>

export const locationReceiptSchema = z.object({
  ok: z.literal(true),
  accepted: z.boolean(),
  reason: z.enum(['ACCEPTED', 'DUPLICATE', 'STALE', 'OUT_OF_ORDER']),
  current_timestamp: z.string().nullable(),
  expires_at: z.string().nullable(),
})
export type LocationReceipt = z.output<typeof locationReceiptSchema>

export const markerSchema = z.object({
  user_id: z.string(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  timestamp: z.string(),
  distance_m: z.number().min(0),
  relationship: z.enum(['friend', 'enemy', 'stranger']),
  accuracy_m: z.number().nullable().optional(),
})
export type Marker = z.output<typeof markerSchema>
export type Relationship = Marker['relationship']

export const nearbySchema = z.object({
  user_id: z.string(),
  nearby: z.array(markerSchema),
  retrieved_at: z.string(),
  next_cursor: z.string().nullable(),
  partial: z.boolean(),
  partial_reason: z.string().nullable(),
})
export type NearbyPage = z.output<typeof nearbySchema>
