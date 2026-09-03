-- Function to decrement stock level
CREATE OR REPLACE FUNCTION decrement_stock(p_id INT, decrement_by INT DEFAULT 1)
RETURNS void AS $$
BEGIN
    -- Placeholder for future stock tracking. 
    -- Currently, inventory is managed manually via the 'stock_status' column.
    -- When a 'stock_quantity' column is added, update this function to decrement it.
    
    -- Note: If we had a 'stock_quantity' column, we would decrement that.
    -- Since we only have 'stock_status', we just ensure it stays 'instock' 
    -- or manually managed. Real inventory tracking would need a quantity column.
END;
$$ LANGUAGE plpgsql;
