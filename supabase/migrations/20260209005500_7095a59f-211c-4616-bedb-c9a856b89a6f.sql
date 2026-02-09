
-- Add dependency tree and audit columns to alertas
ALTER TABLE public.alertas
  ADD COLUMN IF NOT EXISTS parent_alerta_id uuid REFERENCES public.alertas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_by uuid,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Index for tree traversal
CREATE INDEX IF NOT EXISTS idx_alertas_parent ON public.alertas(parent_alerta_id) WHERE parent_alerta_id IS NOT NULL;

-- Index for soft-delete filtering
CREATE INDEX IF NOT EXISTS idx_alertas_not_deleted ON public.alertas(deleted) WHERE deleted = false;
