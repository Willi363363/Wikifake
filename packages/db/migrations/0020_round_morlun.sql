CREATE TABLE "page_view" (
	"day" date NOT NULL,
	"page" text NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "page_view_day_page_pk" PRIMARY KEY("day","page")
);
