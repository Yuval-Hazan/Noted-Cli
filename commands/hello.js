export default function helloCommand(program) {
    // console.log('Registering hello command');  // Debug log to ensure the function is called
    program
        .command('hello')
        .description('Prints Hello, World!')
        .action(() => {
            console.log('Hello, World! 🌍');
        });
}
