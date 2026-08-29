/**
 * Built-in merchant catalog: Canadian + US merchants with categories.
 * Seeded into the Defra `Merchant` collection by the bootstrap script
 * (source: "builtin"), where it lives alongside user-added merchants.
 *
 * pattern: lowercase substring matched against normalized merchant/description.
 * Longest pattern wins, so more specific entries beat generic ones.
 */
export interface CatalogEntry {
  pattern: string;
  name: string;
  category: string;
  country: "CA" | "US";
}

const e = (pattern: string, name: string, category: string, country: "CA" | "US" = "CA"): CatalogEntry =>
  ({ pattern, name, category, country });

export const MERCHANT_CATALOG: CatalogEntry[] = [
  // ---- Groceries — Canada ----
  e("loblaws", "Loblaws", "Groceries"), e("sobeys", "Sobeys", "Groceries"),
  e("metro ", "Metro", "Groceries"), e("no frills", "No Frills", "Groceries"),
  e("nofrills", "No Frills", "Groceries"), e("real canadian superstore", "Real Canadian Superstore", "Groceries"),
  e("superstore", "Real Canadian Superstore", "Groceries"), e("save-on-foods", "Save-On-Foods", "Groceries"),
  e("save on foods", "Save-On-Foods", "Groceries"), e("iga ", "IGA", "Groceries"),
  e("freshco", "FreshCo", "Groceries"), e("farm boy", "Farm Boy", "Groceries"),
  e("food basics", "Food Basics", "Groceries"), e("fortinos", "Fortinos", "Groceries"),
  e("zehrs", "Zehrs", "Groceries"), e("valu-mart", "Valu-mart", "Groceries"),
  e("provigo", "Provigo", "Groceries"), e("maxi ", "Maxi", "Groceries"),
  e("longo", "Longo's", "Groceries"), e("t&t supermarket", "T&T Supermarket", "Groceries"),
  e("t & t supermarket", "T&T Supermarket", "Groceries"), e("giant tiger", "Giant Tiger", "Groceries"),
  e("thrifty foods", "Thrifty Foods", "Groceries"), e("safeway", "Safeway", "Groceries"),
  e("co-op food", "Co-op Food", "Groceries"), e("whole foods", "Whole Foods Market", "Groceries", "US"),
  e("costco whol", "Costco Wholesale", "Groceries"), e("costco wholesale", "Costco Wholesale", "Groceries"),
  e("walmart superc", "Walmart Supercentre", "Groceries"), e("wal-mart", "Walmart", "Shopping"),
  e("walmart", "Walmart", "Shopping"),
  // ---- Groceries — US ----
  e("trader joe", "Trader Joe's", "Groceries", "US"), e("kroger", "Kroger", "Groceries", "US"),
  e("albertsons", "Albertsons", "Groceries", "US"), e("publix", "Publix", "Groceries", "US"),
  e("aldi", "Aldi", "Groceries", "US"), e("wegmans", "Wegmans", "Groceries", "US"),
  e("h-e-b", "H-E-B", "Groceries", "US"), e("sprouts farmers", "Sprouts Farmers Market", "Groceries", "US"),

  // ---- Coffee & fast food ----
  e("tim hortons", "Tim Hortons", "Dining"), e("tims ", "Tim Hortons", "Dining"),
  e("starbucks", "Starbucks", "Dining", "US"), e("second cup", "Second Cup", "Dining"),
  e("mcdonald", "McDonald's", "Dining", "US"), e("a&w", "A&W", "Dining"),
  e("a & w", "A&W", "Dining"), e("harvey", "Harvey's", "Dining"),
  e("wendy", "Wendy's", "Dining", "US"), e("burger king", "Burger King", "Dining", "US"),
  e("kfc", "KFC", "Dining", "US"), e("popeyes", "Popeyes", "Dining", "US"),
  e("taco bell", "Taco Bell", "Dining", "US"), e("subway", "Subway", "Dining", "US"),
  e("chipotle", "Chipotle", "Dining", "US"), e("five guys", "Five Guys", "Dining", "US"),
  e("dairy queen", "Dairy Queen", "Dining", "US"), e("booster juice", "Booster Juice", "Dining"),
  e("freshii", "Freshii", "Dining"), e("chick-fil-a", "Chick-fil-A", "Dining", "US"),
  e("panera", "Panera Bread", "Dining", "US"), e("domino", "Domino's Pizza", "Dining", "US"),
  e("papa john", "Papa John's", "Dining", "US"), e("little caesars", "Little Caesars", "Dining", "US"),
  e("pizza pizza", "Pizza Pizza", "Dining"), e("pizza 73", "Pizza 73", "Dining"),
  e("pizza hut", "Pizza Hut", "Dining", "US"), e("mary brown", "Mary Brown's", "Dining"),
  e("dunkin", "Dunkin'", "Dining", "US"), e("krispy kreme", "Krispy Kreme", "Dining", "US"),

  // ---- Restaurants ----
  e("swiss chalet", "Swiss Chalet", "Dining"), e("boston pizza", "Boston Pizza", "Dining"),
  e("the keg", "The Keg", "Dining"), e("cactus club", "Cactus Club Cafe", "Dining"),
  e("earls ", "Earls", "Dining"), e("white spot", "White Spot", "Dining"),
  e("st-hubert", "St-Hubert", "Dining"), e("st hubert", "St-Hubert", "Dining"),
  e("cora ", "Cora", "Dining"), e("montana", "Montana's", "Dining"),
  e("east side mario", "East Side Mario's", "Dining"), e("jack astor", "Jack Astor's", "Dining"),
  e("moxie", "Moxies", "Dining"), e("milestones", "Milestones", "Dining"),
  e("kelsey", "Kelseys", "Dining"), e("olive garden", "Olive Garden", "Dining", "US"),
  e("applebee", "Applebee's", "Dining", "US"), e("denny", "Denny's", "Dining", "US"),
  e("ihop", "IHOP", "Dining", "US"), e("red lobster", "Red Lobster", "Dining", "US"),
  e("the cheesecake factory", "The Cheesecake Factory", "Dining", "US"),

  // ---- Food delivery ----
  e("skipthedishes", "SkipTheDishes", "Dining"), e("skip the dishes", "SkipTheDishes", "Dining"),
  e("uber eats", "Uber Eats", "Dining", "US"), e("ubereats", "Uber Eats", "Dining", "US"),
  e("uber *eats", "Uber Eats", "Dining", "US"), e("doordash", "DoorDash", "Dining", "US"),
  e("instacart", "Instacart", "Groceries", "US"), e("grubhub", "Grubhub", "Dining", "US"),
  e("fantuan", "Fantuan Delivery", "Dining"),

  // ---- Streaming & entertainment subscriptions ----
  e("netflix", "Netflix", "Streaming", "US"), e("spotify", "Spotify", "Streaming", "US"),
  e("crave", "Crave", "Streaming"), e("disney plus", "Disney+", "Streaming", "US"),
  e("disney+", "Disney+", "Streaming", "US"), e("disneyplus", "Disney+", "Streaming", "US"),
  e("prime video", "Prime Video", "Streaming", "US"), e("amazon prime", "Amazon Prime", "Streaming", "US"),
  e("apple.com/bill", "Apple Services", "Streaming", "US"), e("apple services", "Apple Services", "Streaming", "US"),
  e("youtube premium", "YouTube Premium", "Streaming", "US"), e("youtubepremium", "YouTube Premium", "Streaming", "US"),
  e("cbc gem", "CBC Gem", "Streaming"), e("paramount", "Paramount+", "Streaming", "US"),
  e("hbo max", "Max (HBO)", "Streaming", "US"), e("hulu", "Hulu", "Streaming", "US"),
  e("peacock", "Peacock", "Streaming", "US"), e("dazn", "DAZN", "Streaming"),
  e("tsn direct", "TSN", "Streaming"), e("sportsnet", "Sportsnet NOW", "Streaming"),
  e("audible", "Audible", "Streaming", "US"), e("kindle unlimited", "Kindle Unlimited", "Streaming", "US"),
  e("twitch", "Twitch", "Streaming", "US"), e("nintendo", "Nintendo", "Streaming", "US"),
  e("playstation", "PlayStation", "Streaming", "US"), e("xbox", "Xbox", "Streaming", "US"),
  e("steam games", "Steam", "Streaming", "US"), e("steampowered", "Steam", "Streaming", "US"),

  // ---- Software & cloud ----
  e("adobe", "Adobe", "Software", "US"), e("github", "GitHub", "Software", "US"),
  e("notion", "Notion", "Software", "US"), e("dropbox", "Dropbox", "Software", "US"),
  e("google one", "Google One", "Software", "US"), e("google storage", "Google One", "Software", "US"),
  e("google *one", "Google One", "Software", "US"), e("icloud", "iCloud+", "Software", "US"),
  e("microsoft 365", "Microsoft 365", "Software", "US"), e("microsoft*", "Microsoft", "Software", "US"),
  e("openai", "OpenAI", "Software", "US"), e("anthropic", "Anthropic", "Software", "US"),
  e("figma", "Figma", "Software", "US"), e("1password", "1Password", "Software"),
  e("jetbrains", "JetBrains", "Software", "US"), e("canva", "Canva", "Software", "US"),
  e("zoom.us", "Zoom", "Software", "US"), e("slack", "Slack", "Software", "US"),
  e("godaddy", "GoDaddy", "Software", "US"), e("squarespace", "Squarespace", "Software", "US"),
  e("shopify", "Shopify", "Software"), e("aws ", "Amazon Web Services", "Software", "US"),
  e("digitalocean", "DigitalOcean", "Software", "US"), e("linode", "Linode", "Software", "US"),
  e("vercel", "Vercel", "Software", "US"), e("netlify", "Netlify", "Software", "US"),

  // ---- Fitness ----
  e("goodlife", "GoodLife Fitness", "Fitness"), e("fit4less", "Fit4Less", "Fitness"),
  e("planet fitness", "Planet Fitness", "Fitness", "US"), e("anytime fitness", "Anytime Fitness", "Fitness", "US"),
  e("orangetheory", "Orangetheory", "Fitness", "US"), e("f45", "F45 Training", "Fitness", "US"),
  e("ymca", "YMCA", "Fitness"), e("classpass", "ClassPass", "Fitness", "US"),
  e("peloton", "Peloton", "Fitness", "US"), e("strava", "Strava", "Fitness", "US"),
  e("myfitnesspal", "MyFitnessPal", "Fitness", "US"), e("touchstone climbing", "Touchstone Climbing", "Fitness", "US"),
  e("altitude gym", "Altitude Gym", "Fitness"), e("climb base5", "Base5 Climbing", "Fitness"),

  // ---- Telecom — Canada ----
  e("rogers", "Rogers", "Telecom"), e("bell canada", "Bell Canada", "Telecom"),
  e("bell mobility", "Bell Mobility", "Telecom"), e("bell aliant", "Bell Aliant", "Telecom"),
  e("telus", "TELUS", "Telecom"), e("freedom mobile", "Freedom Mobile", "Telecom"),
  e("fido", "Fido", "Telecom"), e("koodo", "Koodo", "Telecom"),
  e("virgin plus", "Virgin Plus", "Telecom"), e("virgin mobile", "Virgin Plus", "Telecom"),
  e("videotron", "Vidéotron", "Telecom"), e("shaw ", "Shaw", "Telecom"),
  e("sasktel", "SaskTel", "Telecom"), e("eastlink", "Eastlink", "Telecom"),
  e("public mobile", "Public Mobile", "Telecom"), e("chatr", "Chatr", "Telecom"),
  e("lucky mobile", "Lucky Mobile", "Telecom"), e("teksavvy", "TekSavvy", "Telecom"),
  e("start.ca", "Start.ca", "Telecom"), e("oxio", "Oxio", "Telecom"),
  // ---- Telecom — US ----
  e("verizon", "Verizon", "Telecom", "US"), e("at&t", "AT&T", "Telecom", "US"),
  e("t-mobile", "T-Mobile", "Telecom", "US"), e("comcast", "Comcast Xfinity", "Telecom", "US"),
  e("xfinity", "Comcast Xfinity", "Telecom", "US"), e("spectrum", "Spectrum", "Telecom", "US"),

  // ---- Utilities ----
  e("hydro one", "Hydro One", "Utilities"), e("toronto hydro", "Toronto Hydro", "Utilities"),
  e("bc hydro", "BC Hydro", "Utilities"), e("hydro-quebec", "Hydro-Québec", "Utilities"),
  e("hydro quebec", "Hydro-Québec", "Utilities"), e("enbridge", "Enbridge Gas", "Utilities"),
  e("fortisbc", "FortisBC", "Utilities"), e("fortis bc", "FortisBC", "Utilities"),
  e("epcor", "EPCOR", "Utilities"), e("direct energy", "Direct Energy", "Utilities"),
  e("atco ", "ATCO", "Utilities"), e("saskpower", "SaskPower", "Utilities"),
  e("saskenergy", "SaskEnergy", "Utilities"), e("manitoba hydro", "Manitoba Hydro", "Utilities"),
  e("nb power", "NB Power", "Utilities"), e("nova scotia power", "Nova Scotia Power", "Utilities"),
  e("newfoundland power", "Newfoundland Power", "Utilities"), e("maritime electric", "Maritime Electric", "Utilities"),
  e("energir", "Énergir", "Utilities"), e("reliance home", "Reliance Home Comfort", "Utilities"),
  e("enercare", "Enercare", "Utilities"), e("pg&e", "PG&E", "Utilities", "US"),
  e("con edison", "Con Edison", "Utilities", "US"), e("national grid", "National Grid", "Utilities", "US"),

  // ---- Transport: transit, gas, rideshare, parking ----
  e("presto", "PRESTO", "Transport"), e("ttc ", "TTC", "Transport"),
  e("go transit", "GO Transit", "Transport"), e("oc transpo", "OC Transpo", "Transport"),
  e("stm ", "STM", "Transport"), e("translink", "TransLink", "Transport"),
  e("compass card", "Compass Card", "Transport"), e("bc ferries", "BC Ferries", "Transport"),
  e("via rail", "VIA Rail", "Transport"), e("uber trip", "Uber", "Transport", "US"),
  e("uber* trip", "Uber", "Transport", "US"), e("uber bv", "Uber", "Transport", "US"),
  e("uber ", "Uber", "Transport", "US"), e("lyft", "Lyft", "Transport", "US"),
  e("petro-canada", "Petro-Canada", "Transport"), e("petro canada", "Petro-Canada", "Transport"),
  e("esso", "Esso", "Transport"), e("shell ", "Shell", "Transport"),
  e("husky ", "Husky", "Transport"), e("chevron", "Chevron", "Transport", "US"),
  e("ultramar", "Ultramar", "Transport"), e("irving oil", "Irving Oil", "Transport"),
  e("canadian tire gas", "Canadian Tire Gas+", "Transport"), e("costco gas", "Costco Gas", "Transport"),
  e("mobil ", "Mobil", "Transport", "US"), e("7-eleven", "7-Eleven", "Transport", "US"),
  e("407 etr", "407 ETR", "Transport"), e("impark", "Impark", "Transport"),
  e("indigo park", "Indigo Parking", "Transport"), e("green p", "Green P Parking", "Transport"),
  e("precise parklink", "Precise ParkLink", "Transport"), e("honk mobile", "HonkMobile", "Transport"),
  e("communauto", "Communauto", "Transport"), e("evo car share", "Evo Car Share", "Transport"),
  e("bixi", "BIXI", "Transport"), e("bike share toronto", "Bike Share Toronto", "Transport"),

  // ---- Airlines & travel ----
  e("air canada", "Air Canada", "Transport"), e("westjet", "WestJet", "Transport"),
  e("porter air", "Porter Airlines", "Transport"), e("flair air", "Flair Airlines", "Transport"),
  e("air transat", "Air Transat", "Transport"), e("united airlines", "United Airlines", "Transport", "US"),
  e("american airlines", "American Airlines", "Transport", "US"), e("delta air", "Delta Air Lines", "Transport", "US"),
  e("southwest air", "Southwest Airlines", "Transport", "US"), e("alaska air", "Alaska Airlines", "Transport", "US"),
  e("airbnb", "Airbnb", "Transport", "US"), e("expedia", "Expedia", "Transport", "US"),
  e("booking.com", "Booking.com", "Transport", "US"), e("marriott", "Marriott", "Transport", "US"),
  e("hilton", "Hilton", "Transport", "US"),

  // ---- Pharmacy & personal care ----
  e("shoppers drug mart", "Shoppers Drug Mart", "Shopping"), e("shoppersdrugmart", "Shoppers Drug Mart", "Shopping"),
  e("rexall", "Rexall", "Shopping"), e("london drugs", "London Drugs", "Shopping"),
  e("jean coutu", "Jean Coutu", "Shopping"), e("pharmaprix", "Pharmaprix", "Shopping"),
  e("uniprix", "Uniprix", "Shopping"), e("cvs", "CVS Pharmacy", "Shopping", "US"),
  e("walgreens", "Walgreens", "Shopping", "US"), e("rite aid", "Rite Aid", "Shopping", "US"),

  // ---- Shopping & retail ----
  e("amazon.ca", "Amazon.ca", "Shopping"), e("amazon.com", "Amazon.com", "Shopping", "US"),
  e("amzn mktp", "Amazon Marketplace", "Shopping", "US"), e("amazon mktp", "Amazon Marketplace", "Shopping", "US"),
  e("canadian tire", "Canadian Tire", "Shopping"), e("winners", "Winners", "Shopping"),
  e("homesense", "HomeSense", "Shopping"), e("marshalls", "Marshalls", "Shopping", "US"),
  e("best buy", "Best Buy", "Shopping", "US"), e("the source", "The Source", "Shopping"),
  e("ikea", "IKEA", "Shopping"), e("home depot", "Home Depot", "Shopping", "US"),
  e("lowe's", "Lowe's", "Shopping", "US"), e("lowes", "Lowe's", "Shopping", "US"),
  e("rona", "RONA", "Shopping"), e("home hardware", "Home Hardware", "Shopping"),
  e("dollarama", "Dollarama", "Shopping"), e("dollar tree", "Dollar Tree", "Shopping", "US"),
  e("indigo", "Indigo", "Shopping"), e("chapters", "Chapters", "Shopping"),
  e("staples", "Staples", "Shopping"), e("sport chek", "Sport Chek", "Shopping"),
  e("sportchek", "Sport Chek", "Shopping"), e("mark's work", "Mark's", "Shopping"),
  e("marks work", "Mark's", "Shopping"), e("mec ", "MEC", "Shopping"),
  e("mountain equipment", "MEC", "Shopping"), e("lululemon", "Lululemon", "Shopping"),
  e("roots ", "Roots", "Shopping"), e("hudson's bay", "Hudson's Bay", "Shopping"),
  e("the bay", "Hudson's Bay", "Shopping"), e("simons", "Simons", "Shopping"),
  e("old navy", "Old Navy", "Shopping", "US"), e("gap ", "Gap", "Shopping", "US"),
  e("h&m", "H&M", "Shopping"), e("zara", "Zara", "Shopping"),
  e("uniqlo", "Uniqlo", "Shopping"), e("sephora", "Sephora", "Shopping", "US"),
  e("target ", "Target", "Shopping", "US"), e("michaels", "Michaels", "Shopping", "US"),
  e("petsmart", "PetSmart", "Shopping", "US"), e("pet valu", "Pet Valu", "Shopping"),
  e("petland", "Petland", "Shopping"), e("etsy", "Etsy", "Shopping", "US"),
  e("ebay", "eBay", "Shopping", "US"), e("wayfair", "Wayfair", "Shopping", "US"),
  e("temu", "Temu", "Shopping", "US"), e("aliexpress", "AliExpress", "Shopping", "US"),
  e("sparkfun", "SparkFun", "Shopping", "US"), e("madison bicycle", "Madison Bicycle Shop", "Shopping", "US"),
  e("bass pro", "Bass Pro Shops", "Shopping", "US"), e("cabela", "Cabela's", "Shopping"),
  e("princess auto", "Princess Auto", "Shopping"),

  // ---- Liquor ----
  e("lcbo", "LCBO", "Shopping"), e("the beer store", "The Beer Store", "Shopping"),
  e("beer store", "The Beer Store", "Shopping"), e("saq ", "SAQ", "Shopping"),
  e("bc liquor", "BC Liquor Stores", "Shopping"), e("liquor depot", "Liquor Depot", "Shopping"),
  e("wine rack", "Wine Rack", "Shopping"),

  // ---- Insurance & finance ----
  e("intact insurance", "Intact Insurance", "Insurance"), e("desjardins ins", "Desjardins Insurance", "Insurance"),
  e("desjardins assurance", "Desjardins Insurance", "Insurance"), e("manulife", "Manulife", "Insurance"),
  e("sun life", "Sun Life", "Insurance"), e("sunlife", "Sun Life", "Insurance"),
  e("belairdirect", "belairdirect", "Insurance"), e("td insurance", "TD Insurance", "Insurance"),
  e("aviva", "Aviva", "Insurance"), e("wawanesa", "Wawanesa", "Insurance"),
  e("the co-operators", "The Co-operators", "Insurance"), e("cooperators", "The Co-operators", "Insurance"),
  e("economical insurance", "Economical Insurance", "Insurance"), e("allstate", "Allstate", "Insurance", "US"),
  e("geico", "GEICO", "Insurance", "US"), e("state farm", "State Farm", "Insurance", "US"),
  e("sonnet insurance", "Sonnet", "Insurance"), e("square one insurance", "Square One", "Insurance"),

  // ---- Housing ----
  e("rent payment", "Rent", "Housing"), e("rentmoola", "RentMoola", "Housing"),
  e("mortgage pymt", "Mortgage", "Housing"), e("mortgage payment", "Mortgage", "Housing"),
  e("condo fee", "Condo Fees", "Housing"), e("property tax", "Property Tax", "Housing"),

  // ---- Income-ish (money in) ----
  e("payroll", "Payroll", "Income"), e("direct deposit", "Direct Deposit", "Income"),
  e("e-transfer received", "e-Transfer Received", "Income"), e("etransfer received", "e-Transfer Received", "Income"),
  e("canada child benefit", "Canada Child Benefit", "Income"), e("cra ", "CRA", "Income"),
  e("gst/hst credit", "GST/HST Credit", "Income"), e("ei canada", "EI Canada", "Income"),
  e("intrst pymnt", "Interest Payment", "Income"), e("interest paid", "Interest Payment", "Income"),
  e("cd deposit", "Deposit", "Income"),
  e("gusto pay", "Gusto Payroll", "Income", "US"), e("gusto ", "Gusto Payroll", "Income", "US"),
  e("tectra inc", "Tectra Inc", "Shopping", "US"),
];
