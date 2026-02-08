-- Create search_terms table
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS search_terms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  term VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'product', 'category', 'service', 'brand'
  normalized_term VARCHAR(255) NOT NULL, -- lowercase, trimmed version
  category_id UUID REFERENCES category(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  search_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_normalized_term_type UNIQUE(normalized_term, type)
);

-- Indexes for fast searching
CREATE INDEX IF NOT EXISTS idx_search_terms_normalized ON search_terms(normalized_term);
CREATE INDEX IF NOT EXISTS idx_search_terms_type ON search_terms(type);
CREATE INDEX IF NOT EXISTS idx_search_terms_search_count ON search_terms(search_count DESC);
CREATE INDEX IF NOT EXISTS idx_search_terms_category ON search_terms(category_id) WHERE category_id IS NOT NULL;

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_search_terms_updated_at BEFORE UPDATE ON search_terms
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE search_terms IS 'Stores common product names, categories, and search terms for fallback search';
COMMENT ON COLUMN search_terms.normalized_term IS 'Lowercase version of term for case-insensitive matching';
COMMENT ON COLUMN search_terms.search_count IS 'Number of times this term has been searched successfully';
COMMENT ON COLUMN search_terms.metadata IS 'JSON object with brand, aliases, common_searches, etc.';
