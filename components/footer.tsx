import Link from "next/link"

export function Footer() {
  return (
    <footer className="bg-gray-900 border-t border-gray-800 py-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-2xl font-bold text-white mb-4">Biozephyra</h3>
            <p className="text-gray-400 text-sm">
              Making anti-aging research accessible to everyone through AI-powered insights and education.
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Features</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>
                <Link href="/mixer" className="hover:text-teal-400">
                  Compound Mixer
                </Link>
              </li>
              <li>
                <Link href="/research" className="hover:text-teal-400">
                  Research Search
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-teal-400">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/community" className="hover:text-teal-400">
                  Community
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>
                <Link href="/help" className="hover:text-teal-400">
                  Help Center
                </Link>
              </li>
              <li>
                <Link href="/safety" className="hover:text-teal-400">
                  Safety Guidelines
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-teal-400">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>
                <Link href="/privacy" className="hover:text-teal-400">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-teal-400">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/disclaimer" className="hover:text-teal-400">
                  Medical Disclaimer
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center">
          <p className="text-gray-400 text-sm">
            © {new Date().getFullYear()} Biozephyra. All rights reserved. This information is for educational and
            research purposes only and is not medical advice. Always consult a qualified healthcare provider.
          </p>
        </div>
      </div>
    </footer>
  )
}
