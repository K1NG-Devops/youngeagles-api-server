import mysql from 'mysql2/promise';
import 'dotenv/config';
import config from './src/config/database.js';

async function checkAndFixHomeworkSchema() {
    console.log('🔍 Checking homework table schema...');
    
    const connection = await mysql.createConnection(config);
    
    try {
        // First, check current columns
        console.log('📊 Current homework table columns:');
        const [columns] = await connection.execute(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'homework'
            ORDER BY ORDINAL_POSITION
        `);
        
        console.log(columns);
        
        // Check if enhanced fields exist
        const enhancedFields = ['objectives', 'activities', 'materials', 'parent_guidance', 'caps_alignment', 'duration', 'difficulty', 'term'];
        const existingColumns = columns.map(col => col.COLUMN_NAME);
        const missingColumns = enhancedFields.filter(field => !existingColumns.includes(field));
        
        if (missingColumns.length > 0) {
            console.log(`❌ Missing columns: ${missingColumns.join(', ')}`);
            
            // Add missing columns one by one
            for (const column of missingColumns) {
                console.log(`➕ Adding column: ${column}`);
                
                let sql = '';
                switch (column) {
                    case 'objectives':
                        sql = `ALTER TABLE homework ADD COLUMN objectives JSON COMMENT 'Learning objectives array'`;
                        break;
                    case 'activities':
                        sql = `ALTER TABLE homework ADD COLUMN activities JSON COMMENT 'Activities to complete array'`;
                        break;
                    case 'materials':
                        sql = `ALTER TABLE homework ADD COLUMN materials JSON COMMENT 'Required materials array'`;
                        break;
                    case 'parent_guidance':
                        sql = `ALTER TABLE homework ADD COLUMN parent_guidance TEXT COMMENT 'Guidance for parents'`;
                        break;
                    case 'caps_alignment':
                        sql = `ALTER TABLE homework ADD COLUMN caps_alignment VARCHAR(255) COMMENT 'CAPS curriculum alignment'`;
                        break;
                    case 'duration':
                        sql = `ALTER TABLE homework ADD COLUMN duration INT DEFAULT 30 COMMENT 'Estimated duration in minutes'`;
                        break;
                    case 'difficulty':
                        sql = `ALTER TABLE homework ADD COLUMN difficulty ENUM('easy', 'intermediate', 'hard') DEFAULT 'intermediate' COMMENT 'Difficulty level'`;
                        break;
                    case 'term':
                        sql = `ALTER TABLE homework ADD COLUMN term VARCHAR(50) COMMENT 'Academic term'`;
                        break;
                }
                
                try {
                    await connection.execute(sql);
                    console.log(`✅ Added column: ${column}`);
                } catch (error) {
                    if (error.code === 'ER_DUP_FIELDNAME') {
                        console.log(`ℹ️  Column ${column} already exists`);
                    } else {
                        console.error(`❌ Error adding column ${column}:`, error.message);
                    }
                }
            }
            
            // Add indexes
            console.log('📊 Adding indexes...');
            const indexes = [
                { name: 'idx_homework_difficulty', column: 'difficulty' },
                { name: 'idx_homework_caps', column: 'caps_alignment' },
                { name: 'idx_homework_duration', column: 'duration' }
            ];
            
            for (const index of indexes) {
                try {
                    await connection.execute(`CREATE INDEX ${index.name} ON homework(${index.column})`);
                    console.log(`✅ Added index: ${index.name}`);
                } catch (error) {
                    if (error.code === 'ER_DUP_KEYNAME') {
                        console.log(`ℹ️  Index ${index.name} already exists`);
                    } else {
                        console.error(`❌ Error adding index ${index.name}:`, error.message);
                    }
                }
            }
            
            // Update existing records with sample data
            console.log('📝 Updating existing records with sample data...');
            try {
                await connection.execute(`
                    UPDATE homework 
                    SET 
                        objectives = JSON_ARRAY(
                            'Understand key concepts and principles',
                            'Apply learning through practical exercises',
                            'Develop critical thinking skills'
                        ),
                        activities = JSON_ARRAY(
                            'Read assigned materials carefully',
                            'Complete practice exercises',
                            'Prepare for class discussion'
                        ),
                        materials = JSON_ARRAY(
                            'Textbook relevant chapters',
                            'Worksheet packet',
                            'Calculator (if needed)'
                        ),
                        parent_guidance = 'Encourage your child to work through problems step-by-step. Help them organize their workspace and check their work before submission.',
                        caps_alignment = CONCAT('CAPS Grade ', COALESCE(grade, '4'), ' - ', COALESCE(subject, 'General')),
                        duration = 30,
                        difficulty = 'intermediate',
                        term = '2'
                    WHERE objectives IS NULL
                `);
                console.log('✅ Updated existing records with sample data');
            } catch (error) {
                console.error('❌ Error updating existing records:', error.message);
            }
            
        } else {
            console.log('✅ All enhanced fields already exist!');
        }
        
        // Show final schema
        console.log('\n🎉 Final homework table schema:');
        const [finalColumns] = await connection.execute(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'homework'
            ORDER BY ORDINAL_POSITION
        `);
        
        finalColumns.forEach(col => {
            console.log(`${col.COLUMN_NAME} (${col.DATA_TYPE}) - ${col.COLUMN_COMMENT || 'No comment'}`);
        });
        
    } catch (error) {
        console.error('❌ Error checking schema:', error);
    } finally {
        await connection.end();
    }
}

// Run the check and fix
checkAndFixHomeworkSchema().catch(console.error);
