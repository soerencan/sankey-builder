# Third-Party Licenses

This file attributes every third-party package in the production dependency
closure of the site as shipped. `d3-selection`, `d3-scale`,
`d3-scale-chromatic`, `d3-sankey`, `sortablejs`, and `preact` are real npm
dependencies, imported from source and bundled (tree-shaken and minified)
into the site's JavaScript by `bun build`; this file nonetheless attributes
each package's full transitive dependency closure — every module npm
installs alongside it, not just the parts tree-shaking keeps — so every
module's license notice applies whether or not the emitted bundle happens to
still contain that module's code. `d3-scale` pulls in `d3-array`,
`d3-format`, `d3-interpolate` (which pulls in `d3-color`), `d3-time`, and
`d3-time-format`; `d3-scale-chromatic` pulls in `d3-color` and
`d3-interpolate`; `d3-sankey` pulls in `d3-array` and `d3-shape` (which pulls
in `d3-path`); `d3-array` pulls in `internmap`. Over-attribution here is
safe; under-attribution is not.

## D3 modules

Direct dependencies (`d3-selection` 3.0.0, `d3-scale` 4.0.2,
`d3-scale-chromatic` 3.1.0) plus their full transitive closure and
`d3-sankey`'s own (0.12.3): `d3-array` 2.12.1, `d3-color` 3.1.0, `d3-format`
3.1.2, `d3-interpolate` 3.0.1, `d3-path` 1.0.9, `d3-shape` 1.3.7, `d3-time`
3.1.0, `d3-time-format` 4.1.0, and `internmap` 1.0.1. All are published by
Mike Bostock, split across two license families plus one embedded
ColorBrewer notice.

### ISC License

`d3-color`, `d3-format`, `d3-interpolate`, `d3-scale`, `d3-scale-chromatic`
(see also the ColorBrewer notice below), `d3-selection`, `d3-time`,
`d3-time-format`, and `internmap` (a dependency of `d3-array`) are each
ISC-licensed, with only the copyright year differing per package:

```
d3-color:           Copyright 2010-2022 Mike Bostock
d3-format:          Copyright 2010-2026 Mike Bostock
d3-interpolate:     Copyright 2010-2021 Mike Bostock
d3-scale:           Copyright 2010-2021 Mike Bostock
d3-scale-chromatic: Copyright 2010-2024 Mike Bostock
d3-selection:       Copyright 2010-2021 Mike Bostock
d3-time:            Copyright 2010-2022 Mike Bostock
d3-time-format:     Copyright 2010-2021 Mike Bostock
internmap:          Copyright 2021 Mike Bostock

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.
```

### d3-scale-chromatic's embedded ColorBrewer notice (Apache License 2.0)

`d3-scale-chromatic`'s `LICENSE` file additionally embeds an Apache License
2.0 notice for the ColorBrewer color schemes it ships, some of which the app
uses directly (the "Set 2" and "Dark 2" palettes are `schemeSet2` /
`schemeDark2`, both ColorBrewer schemes). It is reproduced here as it
appears upstream:

```
Apache-Style Software License for ColorBrewer software and ColorBrewer Color Schemes

Copyright 2002 Cynthia Brewer, Mark Harrower, and The Pennsylvania State University

Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed
under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
CONDITIONS OF ANY KIND, either express or implied. See the License for the
specific language governing permissions and limitations under the License.
```

### BSD 3-Clause License

`d3-sankey`, `d3-array`, `d3-path`, and `d3-shape` are each BSD-3-Clause
licensed, with only the copyright year differing per package:

```
d3-sankey: Copyright 2015, Mike Bostock
d3-array:  Copyright 2010-2020 Mike Bostock
d3-path:   Copyright 2015-2016 Mike Bostock
d3-shape:  Copyright 2010-2015 Mike Bostock

All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* Neither the name of the author nor the names of contributors may be used to
  endorse or promote products derived from this software without specific prior
  written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

## SortableJS (1.15.7)

MIT License, Copyright (c) 2019 All contributors to Sortable:

```
MIT License

Copyright (c) 2019 All contributors to Sortable

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Preact (10.29.8)

MIT License, Copyright (c) 2015-present Jason Miller:

```
The MIT License (MIT)

Copyright (c) 2015-present Jason Miller

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
