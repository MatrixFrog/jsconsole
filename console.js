(function (window) {

// custom because I want to be able to introspect native browser objects *and* functions
function stringify(o, simple) {
  var json = '', i, type = ({}).toString.call(o), parts = [];
  
  if (type == '[object String]') {
    json = '"' + o.replace(/"/g, '\\"') + '"';
  } else if (type == '[object Array]') {
    json = '[';
    for (i = 0; i < o.length; i++) {
      parts.push(stringify(o[i]));
    }
    json += parts.join(', ') + ']';
    json;
  } else if (type == '[object Object]') {
    json = '{';
    for (i in o) {
      parts.push(stringify(i) + ': ' + stringify(o[i]));
    }
    json += parts.join(', ') + '}';
  } else if (type == '[object Number]') {
    json = o+'';
  } else if (type == '[object Boolean]') {
    json = o ? 'true' : 'false';
  } else if (type == '[object Function]') {
    json = o.toString();
  } else if (o === null) {
    json = 'null';
  } else if (o === undefined) {
    json = 'undefined';
  } else if (simple == undefined) {
    json = type + '{\n';
    for (i in o) {
      parts.push(i + ': ' + stringify(o[i], true)); // safety from max stack
    }
    json += parts.join(',\n') + '\n}';
  } else {
    json = o+''; // should look like an object
  }
  return json;
}

function cleanse(s) {
  return s.replace(/[<>&]/g, function (m) { return {'&':'&amp;','>':'&gt;','<':'&lt;'}[m];});
}

function run(cmd) {
  var rawoutput = null, 
      className = 'response',
      internalCmd = internalCommand(cmd);

  if (internalCmd) {
    return ['info', internalCmd];
  } else {
    try {
      rawoutput = sandboxframe.contentWindow.eval(cmd);
    } catch (e) {
      rawoutput = e.message;
      className = 'error';
    }
    return [className, cleanse(stringify(rawoutput))];
  } 
}

function post(cmd) {
  cmd = trim(cmd);
  history.push(cmd);
  
  echo(cmd);
  
  // order so it appears at the top  
  var el = document.createElement('div'),
      li = document.createElement('li'),
      span = document.createElement('span'),
      parent = output.parentNode, 
      response = run(cmd);
    
  el.className = 'response';
  span.innerHTML = response[1];

  if (response[0] != 'info') prettyPrint([span]);
  el.appendChild(span);

  li.className = response[0];
  li.innerHTML = '<span class="gutter"></span>';
  li.appendChild(el);

  appendLog(li);
    
  output.parentNode.scrollTop = 0;
  if (!body.className) {
    exec.value = '';
    if (cursor.nextSibling) exec.removeChild(cursor.nextSibling);
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
  }
  pos = history.length;
}

function log(msg) {
  var li = document.createElement('li'),
      div = document.createElement('div');

  div.innerHTML = msg;
  prettyPrint([div]);
  li.className = 'log';
  li.innerHTML = '<span class="gutter"></span>';
  li.appendChild(div);

  appendLog(li);
}

function echo(cmd) {
  var li = document.createElement('li');

  li.className = 'echo';
  li.innerHTML = '<span class="gutter"></span><div>' + cleanse(cmd) + '</div>';

  logAfter = output.querySelectorAll('li.echo')[0] || null;
  appendLog(li, true);
}

window.info = function(cmd) {
  var li = document.createElement('li');

  li.className = 'info';
  li.innerHTML = '<span class="gutter"></span><div>' + cleanse(cmd) + '</div>';

  logAfter = output.querySelectorAll('li.echo')[0] || null;
  appendLog(li, true);
}

function appendLog(el, echo) {
  if (echo) {
    if (!output.firstChild) {
      output.appendChild(el);
    } else {
      output.insertBefore(el, output.firstChild);
    }      
  } else {
    output.insertBefore(el, logAfter ? logAfter : output.lastChild.nextSibling);
  }
}

function changeView(event){
  var which = event.which || event.keyCode;
  if (which == 38 && event.shiftKey == true) {
    body.className = '';
    exec.focus();
    return false;
  } else if (which == 40 && event.shiftKey == true) {
    body.className = 'large';
    exec.focus();
    return false;
  }
}

function internalCommand(cmd) {
  var parts = [];
  if (cmd.substr(0, 1) == ':') {
    parts = cmd.substr(1).split(' ');
    return (commands[parts.shift()] || noop).apply(this, parts);
  }
}

function noop() {}

function showhelp() {
  return [
    'up/down - cycle history',
    'shift+up - single line command',
    'shift+down - multiline command', 
    'shift+enter - to run command in multiline mode',
    ':load <script_url> - to inject external script'
  ].join('<br />\n');
}

function loadScript() {
  var doc = sandboxframe.contentDocument || sandboxframe.contentWindow.document;
  for (var i = 0; i < arguments.length; i++) {
    (function (url) {
      var script = document.createElement('script');
      script.src = url
      script.onload = function () {
        window.top.info('Loaded ' + url, 'http://' + window.location.hostname);
      };
      doc.body.appendChild(script);
    })(arguments[i]);
  }
  return "Loading scripts...";
}

function checkTab(evt) {
  var t = evt.target,
      ss = t.selectionStart,
      se = t.selectionEnd,
      tab = "  ";
  

  // Tab key - insert tab expansion
  if (evt.keyCode == 9) {
    evt.preventDefault();

    // Special case of multi line selection
    if (ss != se && t.value.slice(ss,se).indexOf("\n") != -1) {
      // In case selection was not of entire lines (e.g. selection begins in the middle of a line)
      // we ought to tab at the beginning as well as at the start of every following line.
      var pre = t.value.slice(0,ss);
      var sel = t.value.slice(ss,se).replace(/\n/g,"\n"+tab);
      var post = t.value.slice(se,t.value.length);
      t.value = pre.concat(tab).concat(sel).concat(post);

      t.selectionStart = ss + tab.length;
      t.selectionEnd = se + tab.length;
    }

    // "Normal" case (no selection or selection on one line only)
    else {
      t.value = t.value.slice(0,ss).concat(tab).concat(t.value.slice(ss,t.value.length));
      if (ss == se) {
        t.selectionStart = t.selectionEnd = ss + tab.length;
      }
      else {
        t.selectionStart = ss + tab.length;
        t.selectionEnd = se + tab.length;
      }
    }
  }

  // Backspace key - delete preceding tab expansion, if exists
  else if (evt.keyCode==8 && t.value.slice(ss - 4,ss) == tab) {
    evt.preventDefault();

    t.value = t.value.slice(0,ss - 4).concat(t.value.slice(ss,t.value.length));
    t.selectionStart = t.selectionEnd = ss - tab.length;
  }

  // Delete key - delete following tab expansion, if exists
  else if (evt.keyCode==46 && t.value.slice(se,se + 4) == tab) {
    evt.preventDefault();

    t.value = t.value.slice(0,ss).concat(t.value.slice(ss + 4,t.value.length));
    t.selectionStart = t.selectionEnd = ss;
  }
  // Left/right arrow keys - move across the tab in one go
  else if (evt.keyCode == 37 && t.value.slice(ss - 4,ss) == tab) {
    evt.preventDefault();
    t.selectionStart = t.selectionEnd = ss - 4;
  }
  else if (evt.keyCode == 39 && t.value.slice(ss,ss + 4) == tab) {
    evt.preventDefault();
    t.selectionStart = t.selectionEnd = ss + 4;
  }
}

function trim(s) {
  return (s||"").replace(/^\s+|\s+$/g,"");
}

var ccCache = {};
var ccPosition = false;

function getProps(cmd, filter) {
  var surpress = {}, props = [];
  
  if (!ccCache[cmd]) {
    try {
      // surpress alert boxes because they'll actually do something when we're looking
      // up properties inside of the command we're running
      surpress.alert = sandboxframe.contentWindow.alert;
      sandboxframe.contentWindow.alert = function () {};
      
      // loop through all of the properties available on the command (that's evaled)
      ccCache[cmd] = sandboxframe.contentWindow.eval('console.props(' + cmd + ')').sort();
      
      // return alert back to it's former self
      sandboxframe.contentWindow.alert = surpress.alert;
    } catch (e) {
      ccCache[cmd] = [];
    }
    
    // if the return value is undefined, then it means there's no props, so we'll 
    // empty the code completion
    if (ccCache[cmd][0] == 'undefined') ccOptions[cmd] = [];    
    ccPosition = 0;
    props = ccCache[cmd];
  } else if (filter) {
    // console.log('>>' + filter, cmd);
    for (var i = 0, p; i < ccCache[cmd].length, p = ccCache[cmd][i]; i++) {
      if (p.indexOf(filter) === 0) {
        // console.log('pushing ' + ccCache[cmd][i]);
        props.push(p.substr(filter.length, p.length));
      }
    }
  }
  
  return props; 
}

function codeComplete(event) {
  var cmd = cursor.textContent.split(/[;\s]+/g).pop(),
      parts = cmd.split('.'),
      which = whichKey(event),
      cc,
      props = [];

  if (cmd) {
    if (cmd.substr(-1) == '.') {
      // get the command without the '.' so we can eval it and lookup the properties
      cmd = cmd.substr(0, cmd.length - 1);
      
      props = getProps(cmd);
    } else {
      props = getProps(parts[parts.length - 2] || 'window', parts[parts.length - 1]);
    }
    
    if (props.length) {
      if (which == 9) { // tabbing cycles through the code completion
        if (event.shiftKey) {
          // backwards
          ccPosition = ccPosition == 0 ? props.length - 1 : ccPosition-1;
        } else {
          ccPosition = ccPosition == props.length - 1 ? 0 : ccPosition+1;
        }
      
      } else {
        ccPosition = 0;
      }
    
      // position the code completion next to the cursor
      if (!cursor.nextSibling) {
        cc = document.createElement('span');
        cc.className = 'suggest';
        exec.appendChild(cc);
      } 

      cursor.nextSibling.innerHTML = props[ccPosition];
      exec.value = exec.textContent;

      if (which == 9) return false;
    } else {
      ccPosition = false;
    }
  } else {
    ccPosition = false;
  }
  
  if (ccPosition === false && cursor.nextSibling) {
    exec.removeChild(cursor.nextSibling);
  }
  
  exec.value = exec.textContent;
}

window._console = {
  log: function () {
    var l = arguments.length, i = 0;
    for (; i < l; i++) {
      log(stringify(arguments[i], true));
    }
  },
  dir: function () {
    var l = arguments.length, i = 0;
    for (; i < l; i++) {
      log(stringify(arguments[i]));
    }
  },
  props: function (obj) {
    var props = [], realObj;
    try {
      for (var p in obj) props.push(p);
    } catch (e) {}
    return props;
  }
};

document.addEventListener ? 
  window.addEventListener('message', function (event) {
    post(event.data);
  }, false) : 
  window.attachEvent('onmessage', function () {
    post(window.event.data);
  });

var exec = document.getElementById('exec'),
    form = exec.form || {},
    output = document.getElementById('output'),
    cursor = document.getElementById('cursor'),
    sandboxframe = document.createElement('iframe'),
    sandbox = null,
    fakeConsole = 'window.top._console',
    history = [''],
    pos = 0,
    wide = true,
    body = document.getElementsByTagName('body')[0],
    logAfter = null,
    ccTimer = null,
    commands = { help: showhelp, load: loadScript };

body.appendChild(sandboxframe);
sandboxframe.setAttribute('id', 'sandbox');
sandbox = sandboxframe.contentDocument || sandboxframe.contentWindow.document;
sandbox.open();
// stupid jumping through hoops if Firebug is open, since overwriting console throws error
sandbox.write('<script>(function () { var fakeConsole = ' + fakeConsole + '; if (console != undefined) { for (var k in fakeConsole) { console[k] = fakeConsole[k]; } } else { console = fakeConsole; } })();</script>');
sandbox.close();

// tweaks to interface to allow focus
// if (!('autofocus' in document.createElement('input'))) exec.focus();
cursor.focus();
output.parentNode.tabIndex = 0;

function whichKey(event) {
  var keys = {38:1, 40:1, Up:38, Down:40, Enter:10, 'U+0009':9, 'U+0008':8, 'U+0190':190, 'Right':39};
  return keys[event.keyIdentifier] || event.which || event.keyCode;
}

exec.onkeyup = function (event) {
  clearTimeout(ccTimer);
  setTimeout(function () {
    codeComplete(event);
  }, 200);
}

exec.onkeydown = function (event) {
  event = event || window.event;
  var keys = {38:1, 40:1}, 
      wide = body.className == 'large', 
      which = whichKey(event);
      
  if (typeof which == 'string') which = which.replace(/\/U\+/, '\\u');
  if (keys[which]) {
    if (event.shiftKey) {
      changeView(event);
    } else if (!wide) {
      if (which == 38) { // cycle up
        pos--;
        if (pos < 0) pos = history.length - 1;
      } else if (which == 40) { // down
        pos++;
        if (pos >= history.length) pos = 0;
      } 
      if (history[pos] != undefined) {
        exec.value = history[pos];
        cursor.innerHTML = history[pos];
        cursor.focus();
        return false;
      }
    }
  } else if (which == 13 || which == 10) { // enter (what about the other one)
    if (event.shiftKey == true || event.metaKey || event.ctrlKey || !wide) {
      post(exec.value);
      return false;
    }
  } else if (which == 9 && wide) {
    checkTab(event);
  } else if (event.shiftKey && event.metaKey && which == 8) {
    output.innerHTML = '';
  } else if (which == 39 && ccPosition !== false) { // complete code
    var tmp = exec.textContent;
    if (cursor.nextSibling) exec.removeChild(cursor.nextSibling);
    
    cursor.innerHTML = tmp;
    ccPosition = false;
    
    // daft hack to move the focus elsewhere, then back on to the cursor to
    // move the cursor to the end of the text.
    document.getElementsByTagName('a')[0].focus();
    cursor.focus();
  } else { // try code completion
    // clearTimeout(codeCompleteTimer);
    // codeCompleteTimer = setTimeout(function () {
      // return codeComplete(which);
    // }, 200);
    if (ccPosition !== false && which == 9) {
      return false;
    } else if (ccPosition !== false && cursor.nextSibling) {
      exec.removeChild(cursor.nextSibling);
    }
  }
};

form.onsubmit = function (event) {
  event = event || window.event;
  event.preventDefault && event.preventDefault();
  post(exec.value);
  return false;
};

document.onkeydown = function (event) {
  event = event || window.event;
  var which = event.which || event.keyCode;
  
  if (event.shiftKey && event.metaKey && which == 8) {
    output.innerHTML = '';
    exec.focus();
  } else if (event.target != exec && which == 32) { // space
    output.parentNode.scrollTop += 5 + output.parentNode.offsetHeight * (event.shiftKey ? -1 : 1);
  }
  
  return changeView(event);
};

if (window.location.search) {
  post(decodeURIComponent(window.location.search.substr(1)));
}

setTimeout(function () {
  window.scrollTo(0, 1);
}, 13);

getProps('window'); // cache 


})(this);