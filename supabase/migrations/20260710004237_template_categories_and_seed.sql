-- ============================================================
-- Template categories + 5 additional sample project templates
-- ============================================================

alter table public.project_templates add column category text not null default 'general';

update public.project_templates set category = 'residential_build' where template_name = 'New Residential Home Build';

do $$
declare
  v_tmpl uuid;
begin
  -- ==================== Home Renovation / Remodel ====================
  insert into public.project_templates (template_name, description, category, is_active)
  values ('Home Renovation / Remodel', 'Whole-house renovation covering strip-out through to finishes and handover.', 'renovation', true)
  returning id into v_tmpl;

  insert into public.task_templates
    (project_template_id, phase_name, phase_description, task_title, task_description, sort_order, default_priority, estimated_duration_days)
  values
    (v_tmpl,'Planning & Permits','Scope, surveys and approvals','Confirm renovation scope with client','Walk the property and agree final scope of works.',10,'high',3),
    (v_tmpl,'Planning & Permits',null,'Submit renovation permit application','Lodge plans with local authority where required.',20,'high',10),
    (v_tmpl,'Planning & Permits',null,'Asbestos / lead survey','Required for pre-2000 builds before demolition starts.',30,'high',3),
    (v_tmpl,'Demolition & Strip-out','Clear the space','Strip out fixtures and finishes','Remove existing joinery, flooring and fittings.',10,'medium',3),
    (v_tmpl,'Demolition & Strip-out',null,'Remove non-structural walls','Per approved drawings only.',20,'medium',2),
    (v_tmpl,'Demolition & Strip-out',null,'Skip / waste removal','Schedule skips for demolition waste.',30,'low',1),
    (v_tmpl,'Structural & Rough-ins','Rebuild the bones','Structural alterations per engineer','Beams, lintels and load-bearing changes.',10,'high',5),
    (v_tmpl,'Structural & Rough-ins',null,'First-fix electrical rewiring','New circuits, consumer unit if needed.',20,'high',4),
    (v_tmpl,'Structural & Rough-ins',null,'First-fix plumbing rework','Reroute supply and waste for new layout.',30,'high',4),
    (v_tmpl,'Finishes','Walls, floors, paint','Plastering and skim coats','All affected walls and ceilings.',10,'medium',5),
    (v_tmpl,'Finishes',null,'Flooring installation','Per room finish schedule.',20,'medium',4),
    (v_tmpl,'Finishes',null,'Painting internal & external','Two coats, all affected surfaces.',30,'medium',5),
    (v_tmpl,'Fixtures & Fittings','Kit the space out','Kitchen and bathroom fit-out','Install cabinetry and sanitaryware.',10,'medium',5),
    (v_tmpl,'Fixtures & Fittings',null,'Doors and ironmongery','Hang doors, fit handles and locks.',20,'low',2),
    (v_tmpl,'Fixtures & Fittings',null,'Light fittings and switches','Final fix electrical.',30,'low',2),
    (v_tmpl,'Handover','Sign-off','Snag list walk-through','Compile defects list with client.',10,'high',1),
    (v_tmpl,'Handover',null,'Final clean','Builder''s clean throughout.',20,'medium',1),
    (v_tmpl,'Handover',null,'Handover documentation to client','Warranties, manuals, as-built notes.',30,'medium',1);

  -- ==================== Kitchen & Bathroom Remodel ====================
  insert into public.project_templates (template_name, description, category, is_active)
  values ('Kitchen & Bathroom Remodel', 'Focused wet-room and kitchen remodel from design through installation.', 'kitchen_bath', true)
  returning id into v_tmpl;

  insert into public.task_templates
    (project_template_id, phase_name, phase_description, task_title, task_description, sort_order, default_priority, estimated_duration_days)
  values
    (v_tmpl,'Design & Ordering','Lock in the plan','Finalise layout and material selections','Client sign-off on layout, finishes and appliances.',10,'high',5),
    (v_tmpl,'Design & Ordering',null,'Order cabinetry and worktops','Long lead item — order early.',20,'high',2),
    (v_tmpl,'Design & Ordering',null,'Order sanitaryware and tiles','Confirm quantities against final layout.',30,'medium',2),
    (v_tmpl,'Strip-out','Clear existing','Remove existing units and fittings','Kitchen units or bathroom suite removal.',10,'medium',2),
    (v_tmpl,'Strip-out',null,'Disconnect plumbing and electrical','Isolate supplies safely before works begin.',20,'high',1),
    (v_tmpl,'First-fix','Behind the walls','Reroute plumbing for new layout','Supply and waste to new fixture positions.',10,'high',3),
    (v_tmpl,'First-fix',null,'First-fix electrical for appliances/lighting','Circuits for new appliances and lighting layout.',20,'high',2),
    (v_tmpl,'First-fix',null,'Waterproofing (wet areas)','Tanking to shower and wet-wall zones.',30,'high',2),
    (v_tmpl,'Tiling & Surfaces','Hard finishes','Wall and floor tiling','Per selected tile schedule.',10,'medium',4),
    (v_tmpl,'Tiling & Surfaces',null,'Install worktops / countertops','Template and fit.',20,'medium',2),
    (v_tmpl,'Installation','Fit it out','Install cabinetry and units','Kitchen or vanity units.',10,'medium',3),
    (v_tmpl,'Installation',null,'Install sanitaryware and taps','Bath, basin, WC, mixers.',20,'medium',2),
    (v_tmpl,'Installation',null,'Install appliances','Hob, oven, extractor, dishwasher etc.',30,'low',1),
    (v_tmpl,'Finishing','Final details','Grouting and sealant','All tiled areas and wet joints.',10,'low',1),
    (v_tmpl,'Finishing',null,'Final electrical connections','Test and commission all circuits.',20,'medium',1),
    (v_tmpl,'Finishing',null,'Client walkthrough','Demonstrate fixtures, confirm sign-off.',30,'medium',1);

  -- ==================== Roof Replacement ====================
  insert into public.project_templates (template_name, description, category, is_active)
  values ('Roof Replacement', 'Full re-roof from survey through to final weatherproofing and clean-up.', 'roofing', true)
  returning id into v_tmpl;

  insert into public.task_templates
    (project_template_id, phase_name, phase_description, task_title, task_description, sort_order, default_priority, estimated_duration_days)
  values
    (v_tmpl,'Survey & Materials','Plan the job','Roof survey and photos','Document existing condition and take measurements.',10,'high',1),
    (v_tmpl,'Survey & Materials',null,'Order roofing materials','Tiles/sheeting, underlay, battens.',20,'high',5),
    (v_tmpl,'Survey & Materials',null,'Schedule scaffold / access','Book scaffold erection ahead of start.',30,'medium',3),
    (v_tmpl,'Strip-off','Access & removal','Erect scaffolding and edge protection','Safe access for the full roof area.',10,'high',2),
    (v_tmpl,'Strip-off',null,'Strip old roof covering','Remove existing tiles/sheeting down to structure.',20,'high',2),
    (v_tmpl,'Strip-off',null,'Skip for waste removal','Arrange skip for stripped materials.',30,'low',1),
    (v_tmpl,'Structural Repairs','Fix what''s underneath','Inspect and repair timber structure','Replace any rotten or damaged rafters/trusses.',10,'high',3),
    (v_tmpl,'Structural Repairs',null,'Replace damaged battens / felt','Prep surface for new covering.',20,'medium',2),
    (v_tmpl,'Covering','Weatherproof it','Install new underlay and battens','Full roof area.',10,'high',2),
    (v_tmpl,'Covering',null,'Install tiles / sheeting','Per selected roofing material.',20,'high',4),
    (v_tmpl,'Covering',null,'Install ridge and hip tiles','Cap the roof.',30,'medium',1),
    (v_tmpl,'Finishing','Details & handover','Install gutters and downpipes','New or reinstated rainwater goods.',10,'medium',2),
    (v_tmpl,'Finishing',null,'Flashing and weatherproofing details','Chimneys, valleys and abutments.',20,'high',2),
    (v_tmpl,'Finishing',null,'Final inspection and clean-up','Remove scaffold, site clean, sign-off.',30,'medium',1);

  -- ==================== Commercial Fit-Out / Tenant Improvement ====================
  insert into public.project_templates (template_name, description, category, is_active)
  values ('Commercial Fit-Out', 'Tenant improvement fit-out from design approval through MEP commissioning.', 'commercial', true)
  returning id into v_tmpl;

  insert into public.task_templates
    (project_template_id, phase_name, phase_description, task_title, task_description, sort_order, default_priority, estimated_duration_days)
  values
    (v_tmpl,'Design & Approvals','Get the green light','Space plan sign-off with tenant','Confirm layout, finishes and fixed furniture.',10,'high',5),
    (v_tmpl,'Design & Approvals',null,'Landlord / council approvals','Building consent and landlord fit-out approval.',20,'high',10),
    (v_tmpl,'Design & Approvals',null,'Order long-lead materials','Glazing, joinery, specialist finishes.',30,'medium',3),
    (v_tmpl,'Strip-out & Prep','Clear the shell','Strip out existing fit-out','Remove prior tenant''s fixtures and partitions.',10,'medium',3),
    (v_tmpl,'Strip-out & Prep',null,'Protect base building finishes','Protect lifts, lobbies and shared areas.',20,'low',1),
    (v_tmpl,'MEP First-fix','Behind the ceiling','Electrical first-fix and containment','Cable containment and rough wiring.',10,'high',4),
    (v_tmpl,'MEP First-fix',null,'HVAC ductwork installation','Distribution to new layout.',20,'high',5),
    (v_tmpl,'MEP First-fix',null,'Fire and life-safety rough-in','Sprinklers, alarms, emergency lighting first-fix.',30,'high',4),
    (v_tmpl,'Partitioning & Ceilings','Build the rooms','Stud partition walls','Per approved space plan.',10,'medium',4),
    (v_tmpl,'Partitioning & Ceilings',null,'Suspended ceiling grid and tiles','Full floor area.',20,'medium',3),
    (v_tmpl,'Partitioning & Ceilings',null,'Glazed partitions / doors','Meeting rooms and offices.',30,'medium',3),
    (v_tmpl,'Finishes & Fit-out','Make it usable','Flooring installation','Carpet tile / LVT per schedule.',10,'medium',3),
    (v_tmpl,'Finishes & Fit-out',null,'Paint and wall finishes','All partitions and exposed walls.',20,'medium',3),
    (v_tmpl,'Finishes & Fit-out',null,'Joinery and fixed furniture','Reception desks, kitchenette units, storage.',30,'low',4),
    (v_tmpl,'Commissioning','Prove it works','MEP commissioning and testing','Test and balance all building services.',10,'high',3),
    (v_tmpl,'Commissioning',null,'Fire certification','Sign-off from fire authority.',20,'high',2),
    (v_tmpl,'Commissioning',null,'Client handover and snagging','Walkthrough, punch list, keys handover.',30,'medium',2);

  -- ==================== Home Extension / Addition ====================
  insert into public.project_templates (template_name, description, category, is_active)
  values ('Home Extension / Addition', 'Single-storey extension from planning through to connecting services with the existing house.', 'extension', true)
  returning id into v_tmpl;

  insert into public.task_templates
    (project_template_id, phase_name, phase_description, task_title, task_description, sort_order, default_priority, estimated_duration_days)
  values
    (v_tmpl,'Planning & Permits','Get approved','Architectural drawings sign-off','Client sign-off on final design.',10,'high',5),
    (v_tmpl,'Planning & Permits',null,'Submit building plans for approval','Lodge with local authority.',20,'high',14),
    (v_tmpl,'Planning & Permits',null,'Engineer structural drawings','Foundation and structural design.',30,'high',5),
    (v_tmpl,'Groundworks & Foundations','Get below ground','Excavate foundations','Per engineer''s drawings.',10,'high',3),
    (v_tmpl,'Groundworks & Foundations',null,'Reinforcement and council inspection','Rebar cage and building control sign-off.',20,'high',2),
    (v_tmpl,'Groundworks & Foundations',null,'Pour foundation concrete','Schedule concrete delivery, allow cure time.',30,'high',3),
    (v_tmpl,'Structure','Build up','Build extension walls to wall plate','Blockwork/brickwork to roof level.',10,'high',10),
    (v_tmpl,'Structure',null,'Install steel beams / lintels','Structural openings per engineer.',20,'high',2),
    (v_tmpl,'Structure',null,'Roof structure and covering','Trusses/rafters and roof covering.',30,'high',5),
    (v_tmpl,'Envelope','Weathertight','Windows and external doors','Install per schedule.',10,'medium',3),
    (v_tmpl,'Envelope',null,'External render / cladding','Finish external walls.',20,'medium',5),
    (v_tmpl,'Envelope',null,'Weatherproofing','Seal all external junctions.',30,'medium',2),
    (v_tmpl,'Internal Fit-out','Inside works','First-fix electrical and plumbing','Rough-in for new space.',10,'high',4),
    (v_tmpl,'Internal Fit-out',null,'Plastering','Walls and ceilings throughout.',20,'medium',4),
    (v_tmpl,'Internal Fit-out',null,'Flooring and internal doors','Per finish schedule.',30,'medium',3),
    (v_tmpl,'Finishing','Wrap up','Painting and decorating','Two coats, all surfaces.',10,'medium',4),
    (v_tmpl,'Finishing',null,'Final fix electrical and plumbing','Sockets, switches, sanitaryware.',20,'medium',2),
    (v_tmpl,'Finishing',null,'Connect extension to existing house','Tie in services and open up connecting wall.',30,'high',2);
end $$;
