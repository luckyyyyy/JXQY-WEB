-- Add foreign key constraints for resource_id references.
-- npcs.resource_id → npc_resources.id
-- objs.resource_id → obj_resources.id

-- NPC resource FK (nullable, SET NULL on delete)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_npcs_resource_id'
  ) THEN
    ALTER TABLE npcs
      ADD CONSTRAINT fk_npcs_resource_id
      FOREIGN KEY (resource_id) REFERENCES npc_resources(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Obj resource FK (nullable, SET NULL on delete)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_objs_resource_id'
  ) THEN
    ALTER TABLE objs
      ADD CONSTRAINT fk_objs_resource_id
      FOREIGN KEY (resource_id) REFERENCES obj_resources(id)
      ON DELETE SET NULL;
  END IF;
END $$;
