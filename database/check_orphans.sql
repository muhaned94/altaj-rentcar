-- Check for cars with no branches
SELECT count(*) as orphaned_cars_count
FROM cars 
WHERE id NOT IN (SELECT car_id FROM car_branches);

-- Check total cars
SELECT count(*) as total_cars_count FROM cars;
