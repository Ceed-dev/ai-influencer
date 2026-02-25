-- Add missing triggers for prediction_weights and prediction_snapshots
-- Spec: 03-database-schema.md §9 lines 4524-4530

CREATE TRIGGER IF NOT EXISTS trg_prediction_weights_updated_at
    BEFORE UPDATE ON prediction_weights
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS trg_prediction_snapshots_updated_at
    BEFORE UPDATE ON prediction_snapshots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
