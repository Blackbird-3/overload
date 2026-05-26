const { Client, Databases, Permission, Role } = require('node-appwrite');

const client = new Client()
    .setEndpoint('https://fra.cloud.appwrite.io/v1')
    .setProject('679f79c700304a544f61')
    .setKey('standard_4a21243838a18f8085eeec64e5274a3aaf022ba80502016cc2a5b108233b112c082d66f84fec518e3984d606423694d3a3837a0c12fe275fec6264f09b832f5fab2ee7895ded1282053a933116aa182c9518dbece9c18fffa0bd8b01adb7c97394ec19341cd13be1cfe45afee65a8857d7f85bc7da182af02f0b598084f4fb07');

const databases = new Databases(client);

const DATABASE_ID = 'overload_db';
const COLLECTIONS = ['routines', 'workouts', 'sets'];

async function updatePermissions() {
    try {
        const permissions = [
            Permission.read(Role.users()),
            Permission.create(Role.users()),
            Permission.update(Role.users()),
            Permission.delete(Role.users()),
        ];

        for (const collectionId of COLLECTIONS) {
            console.log(`Updating permissions for ${collectionId}...`);
            await databases.updateCollection(
                DATABASE_ID,
                collectionId,
                collectionId.charAt(0).toUpperCase() + collectionId.slice(1),
                permissions,
                true // documentSecurity enabled
            );
            console.log(`Successfully updated ${collectionId}`);
        }
        console.log('\n✅ Appwrite Permissions Update Complete!');
    } catch (error) {
        console.error('❌ Error updating permissions:', error);
    }
}

updatePermissions();
