const fs = require('fs');
const { SerialPort } = require("serialport");
const path = require("path");

// Set up the serial port
const port = new SerialPort(
    {
        path: 'COM7',
        // 110, 150, 300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600
        baudRate: 2400,
        //dataBits: 8,
        //stopBits: 1,
        //Parity: 'none',
        //flowControl: false
    },
    function (err) {
        if (err) {
          return console.error('Error: Serial Port Connection:', err.message);
        }
    },
)

// Set up a parser to read lines (adjust if needed)
//const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
//const parser = port.pipe(new ByteLengthParser({ length: 64 })); // Read in chunks of 8 bytes

// Handle incoming data
//parser.on('data', (data) => {
//  console.log('Received:', data);
//});
var count = 0;

port.on('data', function (data) {
  count++;

  if (count > 200) process.exit(0);

    let dataString = Buffer.from(data).toString('hex');
    //console.log(dataString);

    fs.writeFileSync(path.resolve('./sample_output/output.txt'), `${dataString}\r\n`, {
       flag: 'a',
    });

    //console.log(Number("0x" + dataString));

    //if (dataString === "24") {
    //    console.log("found beginning of data chunk?");
        // if data is "20" four times in a row
            // FOUND DATA CHUNK - READ THE NEXT 20 BYTES AS PAYLOAD
            //for (let i = 0; i < 20; i++) { 
                // if  data is "0d"
                    // if  data is "0a"
                        //EXIT LOOP

    //        )
    //} 

    

})


// Handle errors
port.on('error', (err) => {
  console.error('Error: Serial Port Error:', err);
});



