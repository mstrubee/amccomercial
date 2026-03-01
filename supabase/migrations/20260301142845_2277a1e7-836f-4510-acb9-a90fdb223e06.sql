ALTER TABLE folder_templates ADD COLUMN is_repo_comun boolean NOT NULL DEFAULT false;
ALTER TABLE project_folders ADD COLUMN is_repo_comun boolean NOT NULL DEFAULT false;