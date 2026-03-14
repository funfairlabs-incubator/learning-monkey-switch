# Networks & How the Internet Works

> Last reviewed: March 2026 · Maintained by Claude

From "what is a LAN?" to how data actually travels across the internet. Written to be readable at any level — start wherever makes sense for you.

---

## The basics — what is a network?

A **network** is two or more devices connected so they can share information. That's it. The complexity comes from the scale: the internet is a network of billions of devices, and the question of how a message finds its way from your laptop in the UK to a server in California in under 100 milliseconds is genuinely fascinating.

---

## LAN, WAN, and everything in between

### LAN — Local Area Network

Your home Wi-Fi is a LAN. Your school or office network is a LAN. All the devices on it — your phone, laptop, smart TV, printer — can communicate with each other directly because they're physically close and on the same network.

A LAN is typically managed by a **router**, which connects your local network to the wider internet.

### WAN — Wide Area Network

A WAN connects multiple LANs across large distances. The internet is the largest WAN in existence. Your home router has two connections: one to your local devices (the LAN side) and one to your ISP (the WAN side).

### Other network types

- **MAN** (Metropolitan Area Network): a network covering a city — e.g. a university campus across multiple buildings
- **VPN** (Virtual Private Network): software that creates an encrypted "tunnel" over the internet, making it appear as if you're on a private network — common for remote working

---

## Part 1 — How data actually travels

### IP addresses

Every device on a network has an **IP address** — a numerical label like `192.168.1.5` (on your local network) or `142.250.187.46` (a public address). It's how the network knows where to send data.

**IPv4** addresses (the old format: four numbers 0–255 separated by dots) are running out because there are only ~4 billion possible combinations and the internet has more devices than that. **IPv6** was invented to solve this — it uses 128 bits instead of 32, giving roughly 340 undecillion possible addresses.

**Private vs public IP addresses**: Your devices on your home network have private IPs (usually starting `192.168.x.x` or `10.x.x.x`). Your router has one public IP address facing the internet. Network Address Translation (NAT) is how your router maps private addresses to the single public one.

### Packets

Data doesn't travel as one continuous stream — it's broken into **packets**, small chunks typically 1,500 bytes. Each packet is labelled with a source address, destination address, and a sequence number. They may travel different routes and arrive out of order. The receiving end reassembles them.

Why packets? Because networks are shared. If data had to travel as one uninterrupted stream, one large transfer could block everything else.

### The TCP/IP model

The internet is built on a stack of protocols:

**IP (Internet Protocol)** — handles addressing and routing. Gets packets from A to B, best-effort. Doesn't guarantee delivery or order.

**TCP (Transmission Control Protocol)** — sits on top of IP. Adds reliability: checks that all packets arrived, requests retransmission of lost ones, reassembles them in order. Used for web pages, email, file transfers — anything where you need completeness.

**UDP (User Datagram Protocol)** — also sits on top of IP, but without TCP's reliability guarantees. Faster, lower overhead. Used for video calls, gaming, live streams — where a dropped packet is better than a delayed one.

---

## Part 2 — What happens when you type a URL

Type `https://bbc.co.uk` into your browser. Here's what happens:

**1. DNS lookup**
Your browser needs to turn `bbc.co.uk` into an IP address. It asks a **DNS (Domain Name System)** server — the internet's phone book. Your router usually provides a DNS server, which itself queries a chain of authoritative servers. The answer comes back: `151.101.0.81`.

**2. TCP connection**
Your browser opens a TCP connection to that IP address on port 443 (HTTPS). This involves a "handshake" — a brief back-and-forth to establish the connection.

**3. TLS handshake**
For HTTPS, there's a second handshake to establish an encrypted connection. Your browser and the server agree on encryption methods and exchange keys. This is what makes the padlock appear.

**4. HTTP request**
Your browser sends an HTTP GET request: "give me the document at `/`"

**5. HTTP response**
The server responds with the HTML. Your browser parses it, finds references to CSS and JavaScript files, and makes more requests for those.

**6. Rendering**
Browser assembles the page. What feels instant typically involved dozens of separate network requests.

---

## Part 3 — The internet's infrastructure

### Routers and routing

A **router** forwards packets toward their destination. When a packet arrives, the router looks at its destination IP and decides which next hop to send it to, based on a routing table. Large internet routers hold routing tables with hundreds of thousands of entries.

**BGP (Border Gateway Protocol)** is how large networks (called Autonomous Systems) tell each other how to reach IP addresses they control. When a major BGP misconfiguration happens, parts of the internet can become unreachable — this is called a BGP leak or BGP hijack, and it causes real outages. (Facebook's 2021 outage started with a BGP issue.)

### Physical infrastructure

Internet traffic travels over:
- **Fibre optic cables** — light pulses through glass fibres. Incredibly fast, carries enormous bandwidth
- **Submarine cables** — most international internet traffic travels over cables on the sea floor. There are hundreds of thousands of kilometres of them
- **Wireless** — Wi-Fi (local), 4G/5G (mobile), and satellite (e.g. Starlink for remote areas)

**Data centres** house the servers that run websites, cloud services, and everything else. A large data centre might contain hundreds of thousands of servers. They're located strategically around the world to reduce latency.

### CDNs (Content Delivery Networks)

A CDN stores copies of content in data centres around the world. When you load a website, you might be served files from a CDN node 50km away rather than a server in another country. This reduces latency significantly. Cloudflare, Akamai, and Fastly are major CDN providers.

---

## Part 4 — Security basics

### Firewalls

A firewall controls which network traffic is allowed in and out. At home, your router includes a basic firewall. Organisations use more sophisticated firewalls that can inspect traffic, block specific services, and log everything.

### Encryption

HTTPS uses **TLS** to encrypt traffic between your browser and the server. Without it, anyone on the same network (e.g. a coffee shop Wi-Fi) could read your data in plaintext.

**End-to-end encryption** (used by WhatsApp, Signal) means even the service provider can't read your messages — only the sender and recipient hold the keys.

### Common attacks

- **DNS spoofing**: tricking a device into resolving a domain to a wrong IP address
- **Man-in-the-middle**: intercepting traffic between two parties (HTTPS prevents this)
- **DDoS (Distributed Denial of Service)**: flooding a server with traffic to make it unavailable

---

## GCSE and A-Level reference

### Key terms you need to know

| Term | Definition |
|---|---|
| IP address | Numerical label identifying a device on a network |
| MAC address | Hardware identifier built into a network interface card — unique, doesn't change |
| DNS | System translating domain names to IP addresses |
| HTTP/HTTPS | Protocol for transferring web pages; S = encrypted |
| TCP | Reliable, connection-based transport protocol |
| UDP | Faster, connectionless transport protocol |
| Router | Forwards packets between networks |
| Switch | Connects devices on the same LAN |
| Firewall | Controls allowed network traffic |
| Bandwidth | Maximum data transfer rate of a connection |
| Latency | Time taken for data to travel from source to destination |
| Packet | A small unit of data with addressing information |
| Protocol | A set of rules governing communication |

---

## Further reading and resources

- [BBC Bitesize: Computer Networks](https://www.bbc.co.uk/bitesize/topics/zc6nsbk) — clear GCSE-level coverage
- [How DNS Works (comic)](https://howdns.works) — genuinely fun explanation
- [Cloudflare Learning Centre](https://www.cloudflare.com/learning/) — excellent free explainers on networking, security, CDNs
- [Submarine Cable Map](https://www.submarinecablemap.com) — interactive map of the world's undersea cables
- [Julia Evans' networking zines](https://wizardzines.com) — charming illustrated guides to how networks work
