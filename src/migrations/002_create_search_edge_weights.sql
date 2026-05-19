-- Create search_edge_weights table
CREATE TABLE IF NOT EXISTS search_edge_weights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  search_query VARCHAR(255) NOT NULL,
  selected_term_id UUID REFERENCES search_terms(id) ON DELETE CASCADE,
  selected_type VARCHAR(50) NOT NULL, -- 'category', 'auction', 'tender', 'directSale'
  selected_id UUID NOT NULL, -- ID of the selected item
  weight FLOAT DEFAULT 1.0, -- Increases with each selection
  last_selected_at TIMESTAMP DEFAULT NOW(),
  selection_count INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_search_query_term UNIQUE(search_query, selected_term_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_edge_weights_query ON search_edge_weights(search_query);
CREATE INDEX IF NOT EXISTS idx_edge_weights_weight ON search_edge_weights(weight DESC);
CREATE INDEX IF NOT EXISTS idx_edge_weights_term ON search_edge_weights(selected_term_id);
CREATE INDEX IF NOT EXISTS idx_edge_weights_last_selected ON search_edge_weights(last_selected_at DESC);

COMMENT ON TABLE search_edge_weights IS 'Tracks user selection patterns to improve future search results through learning';
COMMENT ON COLUMN search_edge_weights.weight IS 'Increases by 0.5 with each selection, prioritizing frequently selected items';
COMMENT ON COLUMN search_edge_weights.selection_count IS 'Total number of times this specific item was selected for this query';
