// -----------------------------------------------------------------------------
// - IMPORTS -------------------------------------------------------------------
// -----------------------------------------------------------------------------
// Import modules from npm/node
import Path from 'path';
import HTTP from 'http';
import Express from 'express';
import Yargs from 'yargs';
import Winston from 'winston';
import SocketIOServer from 'socket.io';
import Moment from 'moment';
import _ from 'lodash';

// Import config and modules from project
import Config from './config';
import DashRouter from './dash.router';
import * as StylesheetMiddleware from './stylesheet';
import * as SocketHandler from './socketHandler';

let debug = process.env.NODE_ENV == 'debug';

// -----------------------------------------------------------------------------
// - SERVER OPTIONS ------------------------------------------------------------
// -----------------------------------------------------------------------------
Winston.remove(Winston.transports.Console);
Winston.add(Winston.transports.Console, { timestamp: true, colorize: true });
if (Config.log.file) Winston.add(Winston.transports.File, { timestamp: true, filename: Config.log.path });

Winston.level = debug? 'debug' : 'info';

// Parse command line options with Yargs, taking defaults from config.json
let settings = Yargs
    .option('port', {
        alias: 'p',
        describe: 'Port to listen on',
        type: 'number'
    })
    .default(Config.defaults)
    .usage(`Forge Graphics Server (${Config.project})\nUsage: $0 [-p port]`)
    .help().alias('h', 'help')
    .argv;


// -----------------------------------------------------------------------------
// - EXPRESS APP ---------------------------------------------------------------
// -----------------------------------------------------------------------------
// Create an Express app, using Pug as the view engine
let app = Express();
let server = HTTP.createServer(app);
app.set('view engine', 'pug');
app.locals = _.assign(Config.locals, { debug: debug });

// Pass the app to functions that install middleware which processes SCSS
// and Stylus stylesheets on-demand
StylesheetMiddleware.Styl(app);
StylesheetMiddleware.Sass(app);

// - SERVER --------------------------------------------------------------------
// Serve static directories
for (let pub in Config.publicDirs)
    app.use(`/${pub}`,
        Express.static(Path.join(__dirname, Config.publicDirs[pub])));

// Use the dashboard router module to handle the dashboard view
app.use(['/dash', '/dashboard'], DashRouter);

// Render the character generator when / is accessed
app.get('/', (req, res) => res.render('cg/index'));

// Handle anything else by sending a 404 error page and a 404 status code
app.get('*', (req, res) => res.status(404).render('404'));

// - SOCKET.IO REAL-TIME COMMS -------------------------------------------------
let io = SocketIOServer(server);

// Start the Express app listening on the specified port
server.listen(settings.port, () => {
    // Log some stuff
    Winston.info(`Forge Graphics Server Gen3 (${Config.locals.product} - ${Config.locals.project})`)
    Winston.info(`Listening on port ${settings.port}`);
    Winston.info(`Time of start: ${Moment().format('ddd DD MMM YYYY, HH:mm:ss ZZ')}`)
    Winston.debug('Debug enabled');

    // On any connection, handle it with the function defined in socketHandler.es6
    io.on('connection', SocketHandler.HandleSocket);

    SocketHandler.SetTick();
});

// Export some objects so other modules can use them
export { debug as Debug, io as IO };
