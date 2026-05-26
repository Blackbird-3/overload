const { Client, Databases } = require('node-appwrite');

const client = new Client()
    .setEndpoint('https://fra.cloud.appwrite.io/v1')
    .setProject('679f79c700304a544f61')
    .setKey('standard_4a21243838a18f8085eeec64e5274a3aaf022ba80502016cc2a5b108233b112c082d66f84fec518e3984d606423694d3a3837a0c12fe275fec6264f09b832f5fab2ee7895ded1282053a933116aa182c9518dbece9c18fffa0bd8b01adb7c97394ec19341cd13be1cfe45afee65a8857d7f85bc7da182af02f0b598084f4fb07');

const databases = new Databases(client);

const DATABASE_ID = 'overload_db';
const ROUTINES_COLLECTION_ID = 'routines';
const WORKOUTS_COLLECTION_ID = 'workouts';
const SETS_COLLECTION_ID = 'sets';

async function setup() {
    try {
        console.log('Creating database...');
        try {
            await databases.create(DATABASE_ID, 'Progressive Overload DB');
            console.log('Database created successfully.');
        } catch (error) {
            if (error.code === 409) {
                console.log('Database already exists.');
            } else {
                throw error;
            }
        }

        console.log('Creating routines collection...');
        try {
            await databases.createCollection(DATABASE_ID, ROUTINES_COLLECTION_ID, 'Routines');
            console.log('Routines collection created.');

            await databases.createStringAttribute(DATABASE_ID, ROUTINES_COLLECTION_ID, 'userId', 255, true);
            await databases.createStringAttribute(DATABASE_ID, ROUTINES_COLLECTION_ID, 'name', 255, true);
            await databases.createStringAttribute(DATABASE_ID, ROUTINES_COLLECTION_ID, 'exercises', 10000, true, undefined, true); // array
            
            console.log('Waiting for attributes to be ready...');
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            await databases.createIndex(DATABASE_ID, ROUTINES_COLLECTION_ID, 'userId_idx', 'key', ['userId']);
            console.log('Routines collection configured.');
        } catch (error) {
            if (error.code === 409) console.log('Routines collection already exists.');
            else throw error;
        }

        console.log('Creating workouts collection...');
        try {
            await databases.createCollection(DATABASE_ID, WORKOUTS_COLLECTION_ID, 'Workouts');
            console.log('Workouts collection created.');

            await databases.createStringAttribute(DATABASE_ID, WORKOUTS_COLLECTION_ID, 'userId', 255, true);
            await databases.createDatetimeAttribute(DATABASE_ID, WORKOUTS_COLLECTION_ID, 'date', true);
            await databases.createStringAttribute(DATABASE_ID, WORKOUTS_COLLECTION_ID, 'routineId', 255, false);
            await databases.createStringAttribute(DATABASE_ID, WORKOUTS_COLLECTION_ID, 'notes', 5000, false);
            
            console.log('Waiting for attributes to be ready...');
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            await databases.createIndex(DATABASE_ID, WORKOUTS_COLLECTION_ID, 'userId_idx', 'key', ['userId']);
            console.log('Workouts collection configured.');
        } catch (error) {
            if (error.code === 409) console.log('Workouts collection already exists.');
            else throw error;
        }

        console.log('Creating sets collection...');
        try {
            await databases.createCollection(DATABASE_ID, SETS_COLLECTION_ID, 'Sets');
            console.log('Sets collection created.');

            await databases.createStringAttribute(DATABASE_ID, SETS_COLLECTION_ID, 'userId', 255, true);
            await databases.createStringAttribute(DATABASE_ID, SETS_COLLECTION_ID, 'workoutId', 255, true);
            await databases.createStringAttribute(DATABASE_ID, SETS_COLLECTION_ID, 'exerciseName', 255, true);
            await databases.createFloatAttribute(DATABASE_ID, SETS_COLLECTION_ID, 'weight', true);
            await databases.createIntegerAttribute(DATABASE_ID, SETS_COLLECTION_ID, 'reps', true);
            await databases.createFloatAttribute(DATABASE_ID, SETS_COLLECTION_ID, 'targetWeight', false);
            await databases.createIntegerAttribute(DATABASE_ID, SETS_COLLECTION_ID, 'targetReps', false);
            
            console.log('Waiting for attributes to be ready...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            await databases.createIndex(DATABASE_ID, SETS_COLLECTION_ID, 'userId_idx', 'key', ['userId']);
            await databases.createIndex(DATABASE_ID, SETS_COLLECTION_ID, 'workoutId_idx', 'key', ['workoutId']);
            await databases.createIndex(DATABASE_ID, SETS_COLLECTION_ID, 'exerciseName_idx', 'key', ['exerciseName']);
            console.log('Sets collection configured.');
        } catch (error) {
            if (error.code === 409) console.log('Sets collection already exists.');
            else throw error;
        }

        console.log('\n✅ Appwrite Database Setup Complete!');
    } catch (error) {
        console.error('❌ Error during setup:', error);
    }
}

setup();
