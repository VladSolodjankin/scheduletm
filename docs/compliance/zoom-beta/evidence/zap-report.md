# ZAP Scanning Report

ZAP by [Checkmarx](https://checkmarx.com/).


## Summary of Alerts

| Risk Level | Number of Alerts |
| --- | --- |
| High | 0 |
| Medium | 1 |
| Low | 1 |
| Informational | 9 |




## Insights

| Level | Reason | Site | Description | Statistic |
| --- | --- | --- | --- | --- |
| Low | Warning |  | ZAP warnings logged - see the zap.log file for details | 5    |
| Info | Informational | https://dev.meetli.cc | Percentage of responses with status code 2xx | 100 % |
| Info | Informational | https://dev.meetli.cc | Percentage of endpoints with content type application/javascript | 60 % |
| Info | Informational | https://dev.meetli.cc | Percentage of endpoints with content type image/svg+xml | 10 % |
| Info | Informational | https://dev.meetli.cc | Percentage of endpoints with content type text/css | 10 % |
| Info | Informational | https://dev.meetli.cc | Percentage of endpoints with content type text/html | 20 % |
| Info | Informational | https://dev.meetli.cc | Percentage of endpoints with method GET | 100 % |
| Info | Informational | https://dev.meetli.cc | Count of total endpoints | 10    |
| Info | Informational | https://dev.meetli.cc | Percentage of slow responses | 100 % |







## Alerts

| Name | Risk Level | Number of Instances |
| --- | --- | --- |
| CSP: style-src unsafe-inline | Medium | 3 |
| Timestamp Disclosure - Unix | Low | 1 |
| Base64 Disclosure | Informational | 10 |
| Information Disclosure - Suspicious Comments | Informational | 1 |
| Modern Web Application | Informational | 3 |
| Re-examine Cache-control Directives | Informational | 3 |
| Sec-Fetch-Dest Header is Missing | Informational | 3 |
| Sec-Fetch-Mode Header is Missing | Informational | 3 |
| Sec-Fetch-Site Header is Missing | Informational | 3 |
| Sec-Fetch-User Header is Missing | Informational | 3 |
| Storable and Cacheable Content | Informational | Systemic |




## Alert Detail



### [ CSP: style-src unsafe-inline ](https://www.zaproxy.org/docs/alerts/10055/)



##### Medium (High)

### Description

Content Security Policy (CSP) is an added layer of security that helps to detect and mitigate certain types of attacks. Including (but not limited to) Cross Site Scripting (XSS), and data injection attacks. These attacks are used for everything from data theft to site defacement or distribution of malware. CSP provides a set of standard HTTP headers that allow website owners to declare approved sources of content that browsers should be allowed to load on that page — covered types are JavaScript, CSS, HTML frames, fonts, images and embeddable objects such as Java applets, ActiveX, audio and video files.

* URL: https://dev.meetli.cc
  * Node Name: `https://dev.meetli.cc`
  * Method: `GET`
  * Parameter: `Content-Security-Policy`
  * Attack: ``
  * Evidence: `default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'; script-src 'self' 'wasm-unsafe-eval' https://static.cloudflareinsights.com; script-src-elem 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; style-src-elem 'self' 'unsafe-inline'; img-src 'self' data: blob: https://api.mapbox.com https://*.tiles.mapbox.com; font-src 'self' data: https://api.mapbox.com; worker-src 'self' blob:; child-src 'self' blob:; connect-src 'self' https://dev.meetli.cc https://www.meetli.cc https://apidev.meetli.cc https://api.meetli.cc https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com;`
  * Other Info: `style-src includes unsafe-inline.`
* URL: https://dev.meetli.cc/robots.txt
  * Node Name: `https://dev.meetli.cc/robots.txt`
  * Method: `GET`
  * Parameter: `Content-Security-Policy`
  * Attack: ``
  * Evidence: `default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'; script-src 'self' 'wasm-unsafe-eval' https://static.cloudflareinsights.com; script-src-elem 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; style-src-elem 'self' 'unsafe-inline'; img-src 'self' data: blob: https://api.mapbox.com https://*.tiles.mapbox.com; font-src 'self' data: https://api.mapbox.com; worker-src 'self' blob:; child-src 'self' blob:; connect-src 'self' https://dev.meetli.cc https://www.meetli.cc https://apidev.meetli.cc https://api.meetli.cc https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com;`
  * Other Info: `style-src includes unsafe-inline.`
* URL: https://dev.meetli.cc/sitemap.xml
  * Node Name: `https://dev.meetli.cc/sitemap.xml`
  * Method: `GET`
  * Parameter: `Content-Security-Policy`
  * Attack: ``
  * Evidence: `default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'; script-src 'self' 'wasm-unsafe-eval' https://static.cloudflareinsights.com; script-src-elem 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; style-src-elem 'self' 'unsafe-inline'; img-src 'self' data: blob: https://api.mapbox.com https://*.tiles.mapbox.com; font-src 'self' data: https://api.mapbox.com; worker-src 'self' blob:; child-src 'self' blob:; connect-src 'self' https://dev.meetli.cc https://www.meetli.cc https://apidev.meetli.cc https://api.meetli.cc https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com;`
  * Other Info: `style-src includes unsafe-inline.`


Instances: 3

### Solution

Ensure that your web server, application server, load balancer, etc. is properly configured to set the Content-Security-Policy header.

### Reference


* [ https://www.w3.org/TR/CSP/ ](https://www.w3.org/TR/CSP/)
* [ https://caniuse.com/#search=content+security+policy ](https://caniuse.com/#search=content+security+policy)
* [ https://content-security-policy.com/ ](https://content-security-policy.com/)
* [ https://github.com/HtmlUnit/htmlunit-csp ](https://github.com/HtmlUnit/htmlunit-csp)
* [ https://web.dev/articles/csp#resource-options ](https://web.dev/articles/csp#resource-options)


#### CWE Id: [ 693 ](https://cwe.mitre.org/data/definitions/693.html)


#### WASC Id: 15

#### Source ID: 3

### [ Timestamp Disclosure - Unix ](https://www.zaproxy.org/docs/alerts/10096/)



##### Low (Low)

### Description

A timestamp was disclosed by the application/web server. - Unix

* URL: https://dev.meetli.cc/assets/I18nContext-BKUbRXAX.js
  * Node Name: `https://dev.meetli.cc/assets/I18nContext-BKUbRXAX.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `1540483477`
  * Other Info: `1540483477, which evaluates to: 2018-10-25 16:04:37.`


Instances: 1

### Solution

Manually confirm that the timestamp data is not sensitive, and that the data cannot be aggregated to disclose exploitable patterns.

### Reference


* [ https://cwe.mitre.org/data/definitions/200.html ](https://cwe.mitre.org/data/definitions/200.html)


#### CWE Id: [ 497 ](https://cwe.mitre.org/data/definitions/497.html)


#### WASC Id: 13

#### Source ID: 3

### [ Base64 Disclosure ](https://www.zaproxy.org/docs/alerts/10094/)



##### Informational (Medium)

### Description

Base64 encoded data was disclosed by the application/web server. Note: in the interests of performance not all base64 strings in the response were analyzed individually, the entire response should be looked at by the analyst/security team/developer(s).

* URL: https://dev.meetli.cc
  * Node Name: `https://dev.meetli.cc`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `/assets/logo_one_latter-DesWG7-J`
  * Other Info: `��,z�?��(����V�������`
* URL: https://dev.meetli.cc
  * Node Name: `https://dev.meetli.cc`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `2B11NysYqMNPRx4H8UDdVT3d7jgxWum5TDbyb2wZsAJT04LnTzrXPI`
  * Other Info: `�u7+��OG�@�U=��81Z�L6�ol�Sӂ�O:�<`
* URL: https://dev.meetli.cc/assets/Grow-filgiuOJ.js
  * Node Name: `https://dev.meetli.cc/assets/Grow-filgiuOJ.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `IsWIIaKXbstXci4y8UaKXUmysmbLQ8kuRiQ8v2nWRwMhRLCBENg93bUVNpKa5YsWsX0tmpxZyvchnv03sTwhFU7NZdeHxUOkxEahQGx4FyKqUeXwKCQjq6ffvL7f7dLI`
  * Other Info: `"ň!��n�Wr.2�F�]I��f�C�.F$<�i�G!D���=ݵ6����}-��Y��!��7�<!N�eׇ�C��F�@lx"�Q��($#��߼�����`
* URL: https://dev.meetli.cc/assets/I18nContext-BKUbRXAX.js
  * Node Name: `https://dev.meetli.cc/assets/I18nContext-BKUbRXAX.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `2BkAj0tf9YDvtJqCq5HBNCg7tjHLXmZAalTZ8e`
  * Other Info: `� �K_��ﴚ����4(;�1�^f@jT��`
* URL: https://dev.meetli.cc/assets/Select-DbjEQ4dZ.js
  * Node Name: `https://dev.meetli.cc/assets/Select-DbjEQ4dZ.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `zNQlVnjMYnxfJN5zyp9IznTQzrQJpkbr8xhbeC8zenlTUOxDgr`
  * Other Info: `��%Vx�b|_$�sʟH�t�δ	�F��[x/3zySP�C�`
* URL: https://dev.meetli.cc/assets/constants-B8Faz0Zy.js
  * Node Name: `https://dev.meetli.cc/assets/constants-B8Faz0Zy.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `2BBL6gzEMzEsFrzv7RPTIpg60WotAroLyJ8LK8NTK7w8yk`
  * Other Info: `�K��31,����"�:�j-�ȟ+�S+�<�`
* URL: https://dev.meetli.cc/assets/index-Bv8iqoUP.js
  * Node Name: `https://dev.meetli.cc/assets/index-Bv8iqoUP.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `2FuKfCMDKOkUyfnmopECoLSAKdSLRAIxI4CSdYOVsMJCvVfL5aFwKC`
  * Other Info: `�[�|#(���梑���)ԋD1#��u����B�W��p(`
* URL: https://dev.meetli.cc/assets/index-BvQ7Uj6e.css
  * Node Name: `https://dev.meetli.cc/assets/index-BvQ7Uj6e.css`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `2B1esNqnp9alUPpcA8r4WnjElhLAuto4YTpSLIdItd4qGdkJpeIW9Sjp74mqThopiShX38G3KvWA09YMusripF7rEtVjbqx1C8`
  * Other Info: `�^�ڧ�֥P�\��ZxĖ���8a:R,�H��*�	���(�N)�(W���*�������^��cn�u`
* URL: https://dev.meetli.cc/robots.txt
  * Node Name: `https://dev.meetli.cc/robots.txt`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `2BSnCzdzKcjz2FzruC7nv9dXc4WsKXbMC8l8Uvx3px6xMlVY0L6KC46k3qrbXpeWf217GhhCclOHcCwKFhKOIxwOzNyUv5U17H`
  * Other Info: `��7s)���\�.��Ws��)v��|R�w��2UXо���ު�^��m{BrS�p,
�#�ܔ��5�`
* URL: https://dev.meetli.cc/sitemap.xml
  * Node Name: `https://dev.meetli.cc/sitemap.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `2FyC8LCJTmeR8ICfu8xVDt5uG0WwQCLxXS`
  * Other Info: `�\��Ng������U�nE�@"�]`


Instances: 10

### Solution

Manually confirm that the Base64 data does not leak sensitive information, and that the data cannot be aggregated/used to exploit other vulnerabilities.

### Reference


* [ https://projects.webappsec.org/w/page/13246936/Information%20Leakage ](https://projects.webappsec.org/w/page/13246936/Information%20Leakage)


#### CWE Id: [ 319 ](https://cwe.mitre.org/data/definitions/319.html)


#### WASC Id: 13

#### Source ID: 3

### [ Information Disclosure - Suspicious Comments ](https://www.zaproxy.org/docs/alerts/10027/)



##### Informational (Medium)

### Description

The response appears to contain suspicious comments which may help an attacker.

* URL: https://dev.meetli.cc/assets/index-Bv8iqoUP.js
  * Node Name: `https://dev.meetli.cc/assets/index-Bv8iqoUP.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `in response to some user interaction or stat`
  * Other Info: `The following pattern was used: \bUSER\b and was detected in likely comment: "//,``).split(`/`);p=`/`+f.replace(/^\//,``).split(`/`).slice(e.length).join(`/`)}let m=n&&n.state.matches.length?n.state.matches", see evidence field for the suspicious comment/snippet.`


Instances: 1

### Solution

Remove all comments that return information that may help an attacker and fix any underlying problems they refer to.

### Reference



#### CWE Id: [ 615 ](https://cwe.mitre.org/data/definitions/615.html)


#### WASC Id: 13

#### Source ID: 3

### [ Modern Web Application ](https://www.zaproxy.org/docs/alerts/10109/)



##### Informational (Medium)

### Description

The application appears to be a modern web application. If you need to explore it automatically then the Client Spider may well be more effective than the standard one.

* URL: https://dev.meetli.cc
  * Node Name: `https://dev.meetli.cc`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script type="module" crossorigin src="/assets/index-Bv8iqoUP.js"></script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`
* URL: https://dev.meetli.cc/robots.txt
  * Node Name: `https://dev.meetli.cc/robots.txt`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script type="module" crossorigin src="/assets/index-Bv8iqoUP.js"></script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`
* URL: https://dev.meetli.cc/sitemap.xml
  * Node Name: `https://dev.meetli.cc/sitemap.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script type="module" crossorigin src="/assets/index-Bv8iqoUP.js"></script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`


Instances: 3

### Solution

This is an informational alert and so no changes are required.

### Reference




#### Source ID: 3

### [ Re-examine Cache-control Directives ](https://www.zaproxy.org/docs/alerts/10015/)



##### Informational (Low)

### Description

The cache-control header has not been set properly or is missing, allowing the browser and proxies to cache content. For static assets like css, js, or image files this might be intended, however, the resources should be reviewed to ensure that no sensitive content will be cached.

* URL: https://dev.meetli.cc
  * Node Name: `https://dev.meetli.cc`
  * Method: `GET`
  * Parameter: `cache-control`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://dev.meetli.cc/robots.txt
  * Node Name: `https://dev.meetli.cc/robots.txt`
  * Method: `GET`
  * Parameter: `cache-control`
  * Attack: ``
  * Evidence: `max-age=14400`
  * Other Info: ``
* URL: https://dev.meetli.cc/sitemap.xml
  * Node Name: `https://dev.meetli.cc/sitemap.xml`
  * Method: `GET`
  * Parameter: `cache-control`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``


Instances: 3

### Solution

For secure content, ensure the cache-control HTTP header is set with "no-cache, no-store, must-revalidate". If an asset should be cached consider setting the directives "public, max-age, immutable".

### Reference


* [ https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#web-content-caching ](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#web-content-caching)
* [ https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control ](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control)
* [ https://grayduck.mn/2021/09/13/cache-control-recommendations/ ](https://grayduck.mn/2021/09/13/cache-control-recommendations/)


#### CWE Id: [ 525 ](https://cwe.mitre.org/data/definitions/525.html)


#### WASC Id: 13

#### Source ID: 3

### [ Sec-Fetch-Dest Header is Missing ](https://www.zaproxy.org/docs/alerts/90005/)



##### Informational (High)

### Description

Specifies how and where the data would be used. For instance, if the value is audio, then the requested resource must be audio data and not any other type of resource.

* URL: https://dev.meetli.cc
  * Node Name: `https://dev.meetli.cc`
  * Method: `GET`
  * Parameter: `Sec-Fetch-Dest`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://dev.meetli.cc/assets/logo_one_latter-DesWG7-J.svg
  * Node Name: `https://dev.meetli.cc/assets/logo_one_latter-DesWG7-J.svg`
  * Method: `GET`
  * Parameter: `Sec-Fetch-Dest`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://dev.meetli.cc/sitemap.xml
  * Node Name: `https://dev.meetli.cc/sitemap.xml`
  * Method: `GET`
  * Parameter: `Sec-Fetch-Dest`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``


Instances: 3

### Solution

Ensure that Sec-Fetch-Dest header is included in request headers.

### Reference


* [ https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Dest ](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Dest)


#### CWE Id: [ 352 ](https://cwe.mitre.org/data/definitions/352.html)


#### WASC Id: 9

#### Source ID: 3

### [ Sec-Fetch-Mode Header is Missing ](https://www.zaproxy.org/docs/alerts/90005/)



##### Informational (High)

### Description

Allows to differentiate between requests for navigating between HTML pages and requests for loading resources like images, audio etc.

* URL: https://dev.meetli.cc
  * Node Name: `https://dev.meetli.cc`
  * Method: `GET`
  * Parameter: `Sec-Fetch-Mode`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://dev.meetli.cc/assets/logo_one_latter-DesWG7-J.svg
  * Node Name: `https://dev.meetli.cc/assets/logo_one_latter-DesWG7-J.svg`
  * Method: `GET`
  * Parameter: `Sec-Fetch-Mode`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://dev.meetli.cc/sitemap.xml
  * Node Name: `https://dev.meetli.cc/sitemap.xml`
  * Method: `GET`
  * Parameter: `Sec-Fetch-Mode`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``


Instances: 3

### Solution

Ensure that Sec-Fetch-Mode header is included in request headers.

### Reference


* [ https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Mode ](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Mode)


#### CWE Id: [ 352 ](https://cwe.mitre.org/data/definitions/352.html)


#### WASC Id: 9

#### Source ID: 3

### [ Sec-Fetch-Site Header is Missing ](https://www.zaproxy.org/docs/alerts/90005/)



##### Informational (High)

### Description

Specifies the relationship between request initiator's origin and target's origin.

* URL: https://dev.meetli.cc
  * Node Name: `https://dev.meetli.cc`
  * Method: `GET`
  * Parameter: `Sec-Fetch-Site`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://dev.meetli.cc/assets/logo_one_latter-DesWG7-J.svg
  * Node Name: `https://dev.meetli.cc/assets/logo_one_latter-DesWG7-J.svg`
  * Method: `GET`
  * Parameter: `Sec-Fetch-Site`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://dev.meetli.cc/sitemap.xml
  * Node Name: `https://dev.meetli.cc/sitemap.xml`
  * Method: `GET`
  * Parameter: `Sec-Fetch-Site`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``


Instances: 3

### Solution

Ensure that Sec-Fetch-Site header is included in request headers.

### Reference


* [ https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Site ](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Site)


#### CWE Id: [ 352 ](https://cwe.mitre.org/data/definitions/352.html)


#### WASC Id: 9

#### Source ID: 3

### [ Sec-Fetch-User Header is Missing ](https://www.zaproxy.org/docs/alerts/90005/)



##### Informational (High)

### Description

Specifies if a navigation request was initiated by a user.

* URL: https://dev.meetli.cc
  * Node Name: `https://dev.meetli.cc`
  * Method: `GET`
  * Parameter: `Sec-Fetch-User`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://dev.meetli.cc/assets/logo_one_latter-DesWG7-J.svg
  * Node Name: `https://dev.meetli.cc/assets/logo_one_latter-DesWG7-J.svg`
  * Method: `GET`
  * Parameter: `Sec-Fetch-User`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://dev.meetli.cc/sitemap.xml
  * Node Name: `https://dev.meetli.cc/sitemap.xml`
  * Method: `GET`
  * Parameter: `Sec-Fetch-User`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``


Instances: 3

### Solution

Ensure that Sec-Fetch-User header is included in user initiated requests.

### Reference


* [ https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-User ](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-User)


#### CWE Id: [ 352 ](https://cwe.mitre.org/data/definitions/352.html)


#### WASC Id: 9

#### Source ID: 3

### [ Storable and Cacheable Content ](https://www.zaproxy.org/docs/alerts/10049/)



##### Informational (Medium)

### Description

The response contents are storable by caching components such as proxy servers, and may be retrieved directly from the cache, rather than from the origin server by the caching servers, in response to similar requests from other users. If the response data is sensitive, personal or user-specific, this may result in sensitive information being leaked. In some cases, this may even result in a user gaining complete control of the session of another user, depending on the configuration of the caching components in use in their environment. This is primarily an issue where "shared" caching servers such as "proxy" caches are configured on the local network. This configuration is typically found in corporate or educational environments, for instance.

* URL: https://dev.meetli.cc
  * Node Name: `https://dev.meetli.cc`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `In the absence of an explicitly specified caching lifetime directive in the response, a liberal lifetime heuristic of 1 year was assumed. This is permitted by rfc7234.`
* URL: https://dev.meetli.cc/assets/logo_one_latter-DesWG7-J.svg
  * Node Name: `https://dev.meetli.cc/assets/logo_one_latter-DesWG7-J.svg`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=14400`
  * Other Info: ``
* URL: https://dev.meetli.cc/assets/rolldown-runtime-8BhlS34s.js
  * Node Name: `https://dev.meetli.cc/assets/rolldown-runtime-8BhlS34s.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=14400`
  * Other Info: ``
* URL: https://dev.meetli.cc/robots.txt
  * Node Name: `https://dev.meetli.cc/robots.txt`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=14400`
  * Other Info: ``
* URL: https://dev.meetli.cc/sitemap.xml
  * Node Name: `https://dev.meetli.cc/sitemap.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `In the absence of an explicitly specified caching lifetime directive in the response, a liberal lifetime heuristic of 1 year was assumed. This is permitted by rfc7234.`

Instances: Systemic


### Solution

Validate that the response does not contain sensitive, personal or user-specific information. If it does, consider the use of the following HTTP response headers, to limit, or prevent the content being stored and retrieved from the cache by another user:
Cache-Control: no-cache, no-store, must-revalidate, private
Pragma: no-cache
Expires: 0
This configuration directs both HTTP 1.0 and HTTP 1.1 compliant caching servers to not store the response, and to not retrieve the response (without validation) from the cache, in response to a similar request.

### Reference


* [ https://datatracker.ietf.org/doc/html/rfc7234 ](https://datatracker.ietf.org/doc/html/rfc7234)
* [ https://datatracker.ietf.org/doc/html/rfc7231 ](https://datatracker.ietf.org/doc/html/rfc7231)
* [ https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html ](https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html)


#### CWE Id: [ 524 ](https://cwe.mitre.org/data/definitions/524.html)


#### WASC Id: 13

#### Source ID: 3


