// DIFUSO — GLSL shader source strings (ported verbatim from the original tool).
// Plain GLSL ES 1.0; JS-side wiring (createShader/setUniform) happens in the
// effect modules (dither.js, ascii.js, halftone.js, gradient.js), not here.
// Ported from reference/dithr/scripts/shader.js.

// ASCII fragment is based on code made by Humanbydefinition
// https://github.com/humanbydefinition/p5js-ascii-renderer/tree/main
// MIT License https://opensource.org/license/mit

export const ASCII_FRAG = `
	precision highp float;

	uniform sampler2D u_asciiTexture;
	uniform sampler2D u_imageTexture;
	uniform float u_asciiCols;
	uniform float u_asciiRows;
	uniform int u_totalChars;	
	uniform vec2 u_gridCells;
	uniform vec2 u_gridOffset; 
	uniform vec2 u_gridSize;
	uniform vec3 u_charColor;
	uniform vec3 u_bgColor;
	uniform int u_charColorMode; 
	uniform int u_bgColorMode;
	uniform float u_brightness;
	uniform float u_contrast;
	uniform float u_saturation;
	uniform float u_steps;

	void main() {			
			vec2 coord = (gl_FragCoord.xy - u_gridOffset * 0.5) / u_gridCells;
			// if (coord.x < 0.0 || coord.x > 1.0 || coord.y < 0.0 || coord.y > 1.0) {
			// gl_FragColor = vec4(u_bgColor, 1.0);
			// return;
			// }
			coord.y = 1.0 - coord.y;

			vec2 gridCoord = coord * u_gridSize;
			vec2 cellCoord = floor(gridCoord);
			vec2 centerCoord = cellCoord + vec2(0.5);
			vec2 baseCoord = centerCoord / u_gridSize;
			
			float alpha = texture2D(u_imageTexture, baseCoord).a;
			vec3 imageColor = (texture2D(u_imageTexture, baseCoord).rgb - 0.5 + (u_brightness - 1.0)) * u_contrast + 0.5;
			
			float grayscale = dot(imageColor.rgb, vec3(0.299, 0.587, 0.114)) * alpha;
			vec3 imageMixed = mix(imageColor.rgb, vec3(grayscale), u_saturation);	
			vec3 processed = imageMixed - mod(imageMixed, 1.0 / u_steps);
			
			// int charIndex = int(clamp(grayscale * float(u_totalChars), 0.0, float(u_totalChars - 1)));
			// int charIndex = int(clamp(grayscale, 0.0, 1.0) * float(u_totalChars - 1));
				
			// float index = (clamp(grayscale, 0.0, 1.0) * float(u_totalChars - 1));
			float index = clamp(grayscale * float(u_totalChars), 0.0, float(u_totalChars - 1));
			int charIndex = int(index - mod(index, 1.0 / u_steps));

			int charCol = charIndex - int(u_asciiCols) * (charIndex / int(u_asciiCols));
			int charRow = charIndex / int(u_asciiCols);
			vec2 charCoord = vec2(float(charCol) / u_asciiCols, float(charRow) / u_asciiRows);
			vec2 fractCoord = fract(gridCoord) * vec2(1.0 / u_asciiCols, 1.0 / u_asciiRows);
			vec2 texCoord = charCoord + fractCoord;
			vec4 charColor = texture2D(u_asciiTexture, texCoord);

			vec4 finalColor = u_charColorMode == 0 ? vec4(processed.rgb * charColor.rgb, charColor.a) : vec4(u_charColor * charColor.rgb, charColor.a);
			vec4 finalMixed = u_bgColorMode == 0 ? mix(vec4(processed.rgb, 1.0), finalColor, charColor.a) : mix(vec4(u_bgColor, 1.0), finalColor, charColor.a);
					
			gl_FragColor = vec4(finalMixed.rgb, alpha);
	}
`;

// Dither fragment is based on code made by Sean S. LeBlanc
// https://github.com/seleb/ordered-dither-maker
// MIT License https://opensource.org/license/mit

export const DITHER_FRAG = `
	precision highp float; 

	uniform sampler2D u_texture;
	uniform sampler2D u_dither_tex;
	uniform vec2 u_resolution;
	uniform vec2 u_dither_size;
	uniform int u_density;
	uniform float u_scale;
	uniform float u_steps;
	uniform float u_contrast;
	uniform float u_saturation;
	uniform float u_brightness;
	
	void main() {		 
		vec2 coord = vec2(gl_FragCoord.x, 1.0 - gl_FragCoord.y);
		coord -= mod(coord, u_scale);
		if (u_density > 1) coord += u_scale * 0.5;
		
		vec2 uv_dither = fract((coord + vec2(0.5)) / u_dither_size.xy);
		vec2 uv_texture = coord.xy / u_resolution;
		
		float alpha = texture2D(u_texture, uv_texture).a;
		vec4 img = (texture2D(u_texture, uv_texture).rgba - 0.5 + (u_brightness - 1.0)) * u_contrast + 0.5;	
		vec3 limit = texture2D(u_dither_tex, uv_dither).rgb;

		float grayscale = dot(img.rgb, vec3(0.299, 0.587, 0.114)) * img.a;
		vec3 mixed = mix(img.rgb, vec3(grayscale), u_saturation);		
		vec3 processed = mixed - mod(mixed, 1.0/u_steps);
		vec3 dither = step(limit, (mixed - processed) * u_steps) / u_steps;
		
		gl_FragColor = vec4(processed + dither, alpha);
	}
`;

export const HALFTONE_FRAG = `
	precision highp float; 
	uniform sampler2D u_texture;
	uniform vec2 u_resolution;
	uniform float u_size;
	uniform float u_smooth;
	uniform float u_brightness;
	uniform float u_contrast;
	uniform float u_saturation;
	uniform float u_density;
	uniform vec3 u_halfscale;

	float sdCircle(vec2 p, vec2 c, float r){
			return length(p - c) - r;
	}

	void main() {		
		vec2 coord = vec2(gl_FragCoord.x, 1.0 - gl_FragCoord.y);
		vec2 uv_texture = coord.xy / u_resolution;
		
		float alpha = texture2D(u_texture, uv_texture).a;
		vec2 pattern = (floor(coord / u_size) + 0.5) * vec2(u_size);
		vec4 img = (texture2D(u_texture, pattern / u_resolution).rgba - 0.5 + (u_brightness - 1.0)) * u_contrast + 0.5;
		
		float r = img.r * u_size * u_halfscale.r;
		float g = img.g * u_size * u_halfscale.g;
		float b = img.b * u_size * u_halfscale.b;
		
		vec3 dots = vec3(sdCircle(coord, pattern, r), sdCircle(coord, pattern, g), sdCircle(coord, pattern, b));				
		vec3 col = smoothstep(0.0, -u_smooth * u_density, dots);
		
		float grayscale = dot(col, vec3(0.299, 0.587, 0.114)) * img.a;			
		vec3 color = mix(col, vec3(grayscale), u_saturation);	
		
		gl_FragColor = vec4(color, alpha);
	}
`;

export const GRADIENT_FRAG = `
	precision highp float;

	varying vec2 vTexCoord;
	uniform sampler2D u_texture; 
	uniform sampler2D u_gradient; 

	void main() {
		vec2 uv = vec2(vTexCoord.x, 1.0 - vTexCoord.y); 
		float grayscale = texture2D(u_texture, uv).r;
		float alpha = texture2D(u_texture, uv).a;
		vec4 color = texture2D(u_gradient, vec2(grayscale, 0.5)); 

		gl_FragColor = vec4(color.rgb, alpha);
	}
`;

// CMYK halftone effect is public domain, by Stefan Gustavson, adapted by Matt DesLauriers.
// Also uses Ashima's glsl-noise, which is MIT license.
// https://github.com/glslify/glsl-halftone
// MIT License https://opensource.org/license/mit

export const CMYK_HALFTONE_FRAG = `
	precision highp float;
	varying vec2 vTexCoord;
	uniform sampler2D u_texture;
	uniform vec2 u_resolution;
	uniform float u_brightness;
	uniform float u_contrast;
	uniform float u_saturation;
	uniform float u_size;

	vec2 mod289(vec2 x) {
		return x - floor(x * (1.0 / 289.0)) * 289.0;
	}

	vec3 mod289(vec3 x) {
		return x - floor(x * (1.0 / 289.0)) * 289.0;
	}

	vec4 mod289(vec4 x) {
		return x - floor(x * (1.0 / 289.0)) * 289.0;
	}

	vec3 permute(vec3 x) {
		return mod289(((x*34.0)+1.0)*x);
	}

	vec4 permute(vec4 x) {
		return mod289(((x*34.0)+1.0)*x);
	}

	vec4 taylorInvSqrt(vec4 r) {
		return 1.79284291400159 - 0.85373472095314 * r;
	}

	float snoise(vec3 v) {
		const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
		const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

		vec3 i  = floor(v + dot(v, C.yyy) );
		vec3 x0 =   v - i + dot(i, C.xxx) ;

		vec3 g = step(x0.yzx, x0.xyz);
		vec3 l = 1.0 - g;
		vec3 i1 = min( g.xyz, l.zxy );
		vec3 i2 = max( g.xyz, l.zxy );

		vec3 x1 = x0 - i1 + C.xxx;
		vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
		vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

		i = mod289(i);
		vec4 p = permute( permute( permute(
							 i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
						 + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
						 + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

		float n_ = 0.142857142857; // 1.0/7.0
		vec3  ns = n_ * D.wyz - D.xzx;

		vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

		vec4 x_ = floor(j * ns.z);
		vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

		vec4 x = x_ *ns.x + ns.yyyy;
		vec4 y = y_ *ns.x + ns.yyyy;
		vec4 h = 1.0 - abs(x) - abs(y);

		vec4 b0 = vec4( x.xy, y.xy );
		vec4 b1 = vec4( x.zw, y.zw );

		vec4 s0 = floor(b0)*2.0 + 1.0;
		vec4 s1 = floor(b1)*2.0 + 1.0;
		vec4 sh = -step(h, vec4(0.0));

		vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
		vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

		vec3 p0 = vec3(a0.xy,h.x);
		vec3 p1 = vec3(a0.zw,h.y);
		vec3 p2 = vec3(a1.xy,h.z);
		vec3 p3 = vec3(a1.zw,h.w);

		vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
		p0 *= norm.x;
		p1 *= norm.y;
		p2 *= norm.z;
		p3 *= norm.w;
		
		vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
		m = m * m;
		return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
																	dot(p2,x2), dot(p3,x3) ) );
	}

	float snoise(vec2 v) {
		const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
												0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
											 -0.577350269189626,  // -1.0 + 2.0 * C.x
												0.024390243902439); // 1.0 / 41.0
												
		vec2 i  = floor(v + dot(v, C.yy) );
		vec2 x0 = v -   i + dot(i, C.xx);

		vec2 i1;
		i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
		vec4 x12 = x0.xyxy + C.xxzz;
		x12.xy -= i1;

		i = mod289(i); // Avoid truncation effects in permutation
		vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
			+ i.x + vec3(0.0, i1.x, 1.0 ));

		vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
		m = m*m ;
		m = m*m ;
		vec3 x = 2.0 * fract(p * C.www) - 1.0;
		vec3 h = abs(x) - 0.5;
		vec3 ox = floor(x + 0.5);
		vec3 a0 = x - ox;
		m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
		vec3 g;
		g.x  = a0.x  * x0.x  + h.x  * x0.y;
		g.yz = a0.yz * x12.xz + h.yz * x12.yw;
		return 130.0 * dot(m, g);
	}

	float aastep(float threshold, float value) {
	#ifdef GL_OES_standard_derivatives
		float afwidth = length(vec2(dFdx(value), dFdy(value))) * 0.70710678118654757;
		return smoothstep(threshold-afwidth, threshold+afwidth, value);
	#else
		return step(threshold, value);
	#endif  
	}

	vec3 halftone(vec3 texcolor, vec2 st, float frequency) {
		float n = 0.1*snoise(st*600.0); // Fractal noise
		n += 0.05*snoise(st*1200.0);
		n += 0.025*snoise(st*2400.0);
		vec3 white = vec3(n*0.2 + 0.97);
		vec3 black = vec3(n + 0.1);

		vec4 cmyk;
		cmyk.xyz = 1.0 - texcolor;
		cmyk.w = min(cmyk.x, min(cmyk.y, cmyk.z)); // Create K
		cmyk.xyz -= cmyk.w; // Subtract K equivalent from CMY

		vec2 Kst = frequency*mat2(0.707, -0.707, 0.707, 0.707)*st;
		vec2 Kuv = 2.0*fract(Kst)-1.0;
		float k = aastep(0.0, sqrt(cmyk.w)-length(Kuv)+n);
		vec2 Cst = frequency*mat2(0.966, -0.259, 0.259, 0.966)*st;
		vec2 Cuv = 2.0*fract(Cst)-1.0;
		float c = aastep(0.0, sqrt(cmyk.x)-length(Cuv)+n);
		vec2 Mst = frequency*mat2(0.966, 0.259, -0.259, 0.966)*st;
		vec2 Muv = 2.0*fract(Mst)-1.0;
		float m = aastep(0.0, sqrt(cmyk.y)-length(Muv)+n);
		vec2 Yst = frequency*st; // 0 deg
		vec2 Yuv = 2.0*fract(Yst)-1.0;
		float y = aastep(0.0, sqrt(cmyk.z)-length(Yuv)+n);

		vec3 rgbscreen = 1.0 - 0.9*vec3(c,m,y) + n;
		return mix(rgbscreen, black, 0.85*k + 0.3*n);
	}

	vec3 halftone(vec3 texcolor, vec2 st) {
		return halftone(texcolor, st, u_size);
	}

	void main() {
		vec2 uv = vec2(vTexCoord.x, 1.0 - vTexCoord.y);
		vec2 uv_texture = uv.xy / u_resolution;
		
		float alpha = texture2D(u_texture, uv).a;
		vec4 img = (texture2D(u_texture, uv).rgba - 0.5 + (u_brightness - 1.0)) * u_contrast + 0.5;
		
		vec2 st = uv;
		st.x *= u_resolution.x / u_resolution.y;
			
		vec3 color = halftone(img.rgb, st);
		
		float grayscale = dot(color, vec3(0.299, 0.587, 0.114)) * img.a;
		vec3 finalColor = mix(color, vec3(grayscale), u_saturation);
		
		gl_FragColor = vec4(finalColor, alpha);
	}
`;

export const DITHER_VERT = `
attribute vec3 aPosition;

void main() {   
  vec4 positionVec4 = vec4(aPosition, 1.0);
  positionVec4.xy = positionVec4.xy * 2.0 - 1.0;

  gl_Position = positionVec4;
}`;

export const GRADIENT_VERT = `
	attribute vec3 aPosition;
	attribute vec2 aTexCoord;

	varying vec2 vTexCoord;

	void main() {
		vTexCoord = aTexCoord;
		gl_Position = vec4(aPosition.xy*2.-1., aPosition.z, 1.);
	}
`;
