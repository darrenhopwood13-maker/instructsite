ALTER TABLE public.programme_package_links
  ADD CONSTRAINT programme_package_links_project_source_key
  UNIQUE (project_id, source_label);