
-- Clean up duplicate Hunter folder and its children for project casa Vale 2
-- First delete the child (Presupuestos) of the duplicate
DELETE FROM project_folders WHERE id = 'b839de98-bebf-47fd-ae1a-2a3a55975614';
-- Then delete the duplicate Hunter itself (the one without template_id)
DELETE FROM project_folders WHERE id = '84fb5fa2-c36b-42a5-8216-dff54e9ff782';
