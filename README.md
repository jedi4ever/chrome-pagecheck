# Description

A simple way of checking errors via google chrome:
- javascript errors
- unreachable URL
- images that don't load

** Very Alpha, but mostly working **

Reason:
- phantomjs doesn't do flash plugin etc...
- selenium only can grab http request errors through a proxy
- detecting javascript errors in Selenium, require injection of javascript (console.log or window.errors)

# Usage
```
$ chrome-pagecheck http://google.co.uk

visiting http://google.co.uk
found a debugURL through request ws://localhost:9222/devtools/page/312EA575-FF4A-67AA-398A-061118E68ED7
Connecting to remote Chrome session on ws://localhost:9222/devtools/page/312EA575-FF4A-67AA-398A-061118E68ED7
tracing URL request 84165.1 http://google.co.uk
Screen has not changed for 2 seconds
stopping chrome
done
```

exitcodes:
- 0: no errors found
- -1: errors

# Gotchas
- if running from tmux, make sure to install

`brew install reattach-to-user-namespace`
