
SET default_transaction_read_only = off;

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

CREATE ROLE "fitmatch_rehearsal_reader";
ALTER ROLE "fitmatch_rehearsal_reader" WITH INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOBYPASSRLS;

RESET ALL;
