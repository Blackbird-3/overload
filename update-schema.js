const { Client, Databases } = require('node-appwrite');

const client = new Client()
    .setEndpoint('https://fra.cloud.appwrite.io/v1')
    .setProject('679f79c700304a544f61')
    .setKey('standard_4a21243838a18f8085eeec64e5274a3aaf022ba80502016cc2a5b108233b112c082d66f84fec518e3984d606423694d3a3837a0c12fe275fec6264f09b832f5fab2ee7895ded1282053a933116aa182c9518dbece9c18fffa0bd8b01adb7c97394ec19341cd13be1cfe45afee65a8857d7f85bc7da182af02f0b598084f4fb07');

const databases = new Databases(client);

async function update() {
    try {
        console.log('Adding isDropSet to Sets collection...');
        await databases.createBooleanAttribute('overload_db', 'sets', 'isDropSet', false, false);
        console.log('Added isDropSet.');
    } catch(e) { 
        if (e.code === 409) console.log('isDropSet already exists.');
        else console.error(e);
    }

    try {
        console.log('Adding duration to Workouts collection...');
        await databases.createIntegerAttribute('overload_db', 'workouts', 'duration', false, 0, 86400);
        console.log('Added duration.');
    } catch(e) { 
        if (e.code === 409) console.log('duration already exists.');
        else console.error(e);
    }
}
update();
