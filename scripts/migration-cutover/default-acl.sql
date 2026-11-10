-- APP-RECOVERY-32 / R-RESTORE-ACL-32 — READ-ONLY generator, run against the RESTORE TARGET before restoring.
-- mode=off emits REVOKE statements for the target's default privileges (pg_default_acl), mode=on emits the exact
-- GRANTs to put them back. Wrap schema.sql between them inside the single restore transaction so re-created
-- objects get exactly the dumped ACLs, not the target's defaults.
-- Usage: psql "$TARGET_URL" -X -At -v ON_ERROR_STOP=1 -v mode=off -f default-acl.sql > acl-off.sql
--        psql "$TARGET_URL" -X -At -v ON_ERROR_STOP=1 -v mode=on  -f default-acl.sql > acl-on.sql
select case when :'mode' not in ('off', 'on') then 1/0 end; -- refuse anything but off|on
select coalesce(string_agg(format('ALTER DEFAULT PRIVILEGES FOR ROLE %I%s %s %s ON %s %s %s%s;',
    d.defaclrole::regrole::text,
    case when d.defaclnamespace = 0 then '' else format(' IN SCHEMA %I', d.defaclnamespace::regnamespace::text) end,
    case when :'mode' = 'off' then 'REVOKE' else 'GRANT' end, a.privilege_type,
    case d.defaclobjtype when 'r' then 'TABLES' when 'S' then 'SEQUENCES' when 'f' then 'FUNCTIONS' when 'T' then 'TYPES' when 'n' then 'SCHEMAS' end,
    case when :'mode' = 'off' then 'FROM' else 'TO' end,
    case when a.grantee = 0 then 'PUBLIC' else quote_ident(a.grantee::regrole::text) end,
    case when a.is_grantable and :'mode' = 'on' then ' WITH GRANT OPTION' else '' end), E'\n'
    order by d.defaclrole::regrole::text, d.defaclnamespace, d.defaclobjtype, a.grantee, a.privilege_type), '-- no default privileges')
from pg_default_acl d, aclexplode(d.defaclacl) a
where a.grantee <> d.defaclrole;
