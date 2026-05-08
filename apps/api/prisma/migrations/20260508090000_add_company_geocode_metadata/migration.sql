CREATE TYPE "LocationPrecision" AS ENUM ('rooftop', 'street', 'postal_code', 'city', 'state', 'unknown');

CREATE TYPE "GeocodeProvider" AS ENUM ('google', 'census', 'existing');

ALTER TABLE "Company"
ADD COLUMN "locationPrecision" "LocationPrecision",
ADD COLUMN "geocodeProvider" "GeocodeProvider";
