define([
	"./first-day-of-week",
	"./pattern-re",
	"../common/create-error/unsupported-feature",
	"../common/format-message",
	"../number/symbol",
	"../util/string/pad"
], function( dateFirstDayOfWeek, datePatternRe, createErrorUnsupportedFeature, formatMessage,
	numberSymbol, stringPad ) {

/**
 * properties( pattern, cldr )
 *
 * @pattern [String] raw pattern.
 * ref: http://www.unicode.org/reports/tr35/tr35-dates.html#Date_Format_Patterns
 *
 * @cldr [Cldr instance].
 *
 * Return the properties given the pattern and cldr.
 *
 * TODO Support other calendar types.
 */
return function( pattern, cldr, timeZone ) {
	var properties = {
			numberFormatters: {},
			pattern: pattern,
			timeSeparator: numberSymbol( "timeSeparator", cldr )
		},
		widths = [ "abbreviated", "wide", "narrow" ];

	if ( timeZone ) {
		var getTimeZoneData = function( timeZoneData ) {
			if ( timeZoneData.name && timeZoneData.name === timeZone ) {
				return true;
			}
			return false;
		};
		properties.timeZoneData = cldr.get( "globalize-iana/zones" ).filter( getTimeZoneData )[0];
	}

	function setNumberFormatterPattern( pad ) {
		properties.numberFormatters[ pad ] = stringPad( "", pad );
	}

	pattern.replace( datePatternRe, function( current ) {
		var formatNumber,
			chr = current.charAt( 0 ),
			length = current.length,
			metaZone,
			standardTzName,
			daylightTzName,
			genericTzName;

		if ( timeZone && ( chr === "v" || chr === "z" )) {

			// The latest metazone data of the metazone array.
			//TODO expand to support the historic metazones based on the given date.
			metaZone = cldr.supplemental([
				"metaZones/metazoneInfo/timezone", timeZone, 0,
				"usesMetazone/_mzone"
			]);
		}

		if ( chr === "j" ) {

			// Locale preferred hHKk.
			// http://www.unicode.org/reports/tr35/tr35-dates.html#Time_Data
			properties.preferredTime = chr = cldr.supplemental.timeData.preferred();
		}

		// ZZZZ: same as "OOOO".
		if ( chr === "Z" && length === 4 ) {
			chr = "O";
			length = 4;
		}

		// z...zzz: fallback to "O"
		// zzzz: fallback to "OOOO"
		// http://unicode.org/reports/tr35/tr35-dates.html#Date_Format_Patterns
		if ( chr === "z" ) {
			if ( metaZone ) {

				//z...zzz: "{shortRegion}", eg. "PST" or "PDT".
				//zzzz: "{regionName} {Standard Time}" or "{regionName} {Daylight Time}",
				//eg. "Pacific Standard Time" or "Pacific Daylight Time".
				standardTzName = cldr.main([
					"dates/timeZoneNames/metazone",
					metaZone,
					length < 4 ? "short" : "long",
					"standard"
				]);
				daylightTzName = cldr.main([
					"dates/timeZoneNames/metazone",
					metaZone,
					length < 4 ? "short" : "long",
					"daylight"
				]);
			}

			//fall through "O" format
			if ( !metaZone || !standardTzName ) {
				chr = "O";
				if ( length < 4 ) {
					length = 1;
				}
			}
		}

		// v: fallback to "VVVV"
		// vvvv: fallback to "VVVV"
		// http://unicode.org/reports/tr35/tr35-dates.html#Date_Format_Patterns
		if ( chr === "v" ) {
			if ( metaZone ) {

				//v...vvv: "{shortRegion}", eg. "PT".
				//vvvv: "{regionName} {Time}" or "{regionName} {Time}",
				//eg. "Pacific Time"
				genericTzName = cldr.main([
					"dates/timeZoneNames/metazone",
					metaZone,
					length === 1 ? "short" : "long",
					"generic"
				]);
			}

			//fall through "V" format
			if ( !metaZone || !genericTzName ) {
				chr = "V";
				length = 4;
			}
		}

		switch ( chr ) {

			// Era
			case "G":
				properties.eras = cldr.main([
					"dates/calendars/gregorian/eras",
					length <= 3 ? "eraAbbr" : ( length === 4 ? "eraNames" : "eraNarrow" )
				]);
				break;

			// Year
			case "y":

				// Plain year.
				formatNumber = true;
				break;

			case "Y":

				// Year in "Week of Year"
				properties.firstDay = dateFirstDayOfWeek( cldr );
				properties.minDays = cldr.supplemental.weekData.minDays();
				formatNumber = true;
				break;

			case "u": // Extended year. Need to be implemented.
			case "U": // Cyclic year name. Need to be implemented.
				throw createErrorUnsupportedFeature({
					feature: "year pattern `" + chr + "`"
				});

			// Quarter
			case "Q":
			case "q":
				if ( length > 2 ) {
					if ( !properties.quarters ) {
						properties.quarters = {};
					}
					if ( !properties.quarters[ chr ] ) {
						properties.quarters[ chr ] = {};
					}
					properties.quarters[ chr ][ length ] = cldr.main([
						"dates/calendars/gregorian/quarters",
						chr === "Q" ? "format" : "stand-alone",
						widths[ length - 3 ]
					]);
				} else {
					formatNumber = true;
				}
				break;

			// Month
			case "M":
			case "L":
				if ( length > 2 ) {
					if ( !properties.months ) {
						properties.months = {};
					}
					if ( !properties.months[ chr ] ) {
						properties.months[ chr ] = {};
					}
					properties.months[ chr ][ length ] = cldr.main([
						"dates/calendars/gregorian/months",
						chr === "M" ? "format" : "stand-alone",
						widths[ length - 3 ]
					]);
				} else {
					formatNumber = true;
				}
				break;

			// Week - Week of Year (w) or Week of Month (W).
			case "w":
			case "W":
				properties.firstDay = dateFirstDayOfWeek( cldr );
				properties.minDays = cldr.supplemental.weekData.minDays();
				formatNumber = true;
				break;

			// Day
			case "d":
			case "D":
			case "F":
				formatNumber = true;
				break;

			case "g":

				// Modified Julian day. Need to be implemented.
				throw createErrorUnsupportedFeature({
					feature: "Julian day pattern `g`"
				});

			// Week day
			case "e":
			case "c":
				if ( length <= 2 ) {
					properties.firstDay = dateFirstDayOfWeek( cldr );
					formatNumber = true;
					break;
				}

			/* falls through */
			case "E":
				if ( !properties.days ) {
					properties.days = {};
				}
				if ( !properties.days[ chr ] ) {
					properties.days[ chr ] = {};
				}
				if ( length === 6 ) {

					// If short day names are not explicitly specified, abbreviated day names are
					// used instead.
					// http://www.unicode.org/reports/tr35/tr35-dates.html#months_days_quarters_eras
					// http://unicode.org/cldr/trac/ticket/6790
					properties.days[ chr ][ length ] = cldr.main([
							"dates/calendars/gregorian/days",
							chr === "c" ? "stand-alone" : "format",
							"short"
						]) || cldr.main([
							"dates/calendars/gregorian/days",
							chr === "c" ? "stand-alone" : "format",
							"abbreviated"
						]);
				} else {
					properties.days[ chr ][ length ] = cldr.main([
						"dates/calendars/gregorian/days",
						chr === "c" ? "stand-alone" : "format",
						widths[ length < 3 ? 0 : length - 3 ]
					]);
				}
				break;

			// Period (AM or PM)
			case "a":
				properties.dayPeriods = cldr.main(
					"dates/calendars/gregorian/dayPeriods/format/wide"
				);
				break;

			// Hour
			case "h": // 1-12
			case "H": // 0-23
			case "K": // 0-11
			case "k": // 1-24

			// Minute
			case "m":

			// Second
			case "s":
			case "S":
			case "A":
				formatNumber = true;
				break;

			// Zone
			case "z":
				properties.standardTzName = standardTzName;
				properties.daylightTzName = daylightTzName;
				break;

			case "v":
				if ( length !== 1 && length !== 4 ) {
					throw createErrorUnsupportedFeature({
						feature: "timezone pattern `" + pattern + "`"
					});
				}
				properties.genericTzName = genericTzName;
				break;

			case "V":

				if ( length === 1 ) {
					throw createErrorUnsupportedFeature({
						feature: "timezone pattern `" + pattern + "`"
					});
				}

				if ( timeZone ) {
					var timeZoneName;

					if ( length === 2 ) {
						timeZoneName = timeZone;
					}

					var exemplarCity = cldr.main([
						"dates/timeZoneNames/zone", timeZone, "exemplarCity"
					]);

					if ( length === 3 ) {
						if ( !exemplarCity ) {
							exemplarCity = cldr.main([
								"dates/timeZoneNames/zone/Etc/Unknown/exemplarCity"
							]);
						}
						timeZoneName = exemplarCity;
					}

					if ( exemplarCity && length === 4 ) {
						timeZoneName = formatMessage(
							cldr.main(
								"dates/timeZoneNames/regionFormat"
							),
							[ exemplarCity ]
						);
					}
					if ( timeZoneName ) {
						properties.timeZoneName = timeZoneName;
						break;
					}
				}

			/* falls through */
			case "O":

				// O: "{gmtFormat}+H;{gmtFormat}-H" or "{gmtZeroFormat}", eg. "GMT-8" or "GMT".
				// OOOO: "{gmtFormat}{hourFormat}" or "{gmtZeroFormat}", eg. "GMT-08:00" or "GMT".
				properties.gmtFormat = cldr.main( "dates/timeZoneNames/gmtFormat" );
				properties.gmtZeroFormat = cldr.main( "dates/timeZoneNames/gmtZeroFormat" );
				properties.tzLongHourFormat = cldr.main( "dates/timeZoneNames/hourFormat" );

			/* falls through */
			case "Z":
			case "X":
			case "x":
				setNumberFormatterPattern( 1 );
				setNumberFormatterPattern( 2 );
				break;
		}

		if ( formatNumber ) {
			setNumberFormatterPattern( length );
		}
	});

	return properties;
};

});
